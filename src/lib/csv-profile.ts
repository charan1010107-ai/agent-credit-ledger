/** Pure CSV → onboarding-input derivation. Used by the "Upload task history" path of the
 *  agent creation flow. It only produces the SAME inputs the manual sliders produce, so both
 *  paths funnel into deriveStartingProfile() for score / limit / rate / estimated return. */

import { USE_CASES, type Frequency, type UseCaseKey } from "./onboarding";

export const REQUIRED_COLUMNS = [
  "task_date",
  "task_type",
  "task_description",
  "outcome",
  "duration_minutes",
  "cost_incurred",
  "revenue_generated",
  "vendor_used",
] as const;

export const MAX_ROWS = 200;
export const MIN_ROWS = 5;

export type TaskRow = {
  task_date: string;
  task_type: string;
  task_description: string;
  outcome: string;
  duration_minutes: number;
  cost_incurred: number;
  revenue_generated: number;
  vendor_used: string;
};

export type DerivedStats = {
  rows: number;
  truncated: boolean;
  successes: number;
  failures: number;
  successRate: number;
  avgRevenue: number;
  avgCost: number;
  avgDuration: number;
  revenueVariance: number;
  /** 0–100; higher = more consistent revenue across successful tasks. */
  revenueConsistency: number;
  costToRevenue: number;
  spanDays: number;
  tasksPerDay: number;
};

export type CsvDerivation = {
  useCase: UseCaseKey;
  frequency: Frequency;
  riskTolerance: number;
  spendIntensity: number;
  starterTask: string;
  vendors: string[];
  stats: DerivedStats;
  notes: string[];
};

export type ParseResult =
  | { ok: true; value: CsvDerivation }
  | { ok: false; error: string };

/* ------------------------------- csv parsing ------------------------------- */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const num = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[₹$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------- derivation ------------------------------- */

const USE_CASE_KEYWORDS: { key: UseCaseKey; words: string[] }[] = [
  { key: "data_scraping", words: ["scrap", "crawl", "harvest", "extract", "index", "data"] },
  { key: "trading_execution", words: ["trad", "order", "execution", "market", "venue", "rebalanc"] },
  { key: "content_generation", words: ["content", "writ", "article", "copy", "creative", "seo"] },
  { key: "logistics_optimization", words: ["logistic", "route", "fleet", "deliver", "freight", "supply"] },
  { key: "api_automation", words: ["api", "automat", "workflow", "reconcil", "integration", "webhook"] },
];

export function mapTaskType(raw: string): UseCaseKey {
  const s = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const direct = USE_CASES.find((u) => u.key === s);
  if (direct) return direct.key;
  const byLabel = USE_CASES.find((u) => u.label.toLowerCase().replace(/\s+/g, "_") === s);
  if (byLabel) return byLabel.key;
  const hit = USE_CASE_KEYWORDS.find((k) => k.words.some((w) => s.includes(w)));
  return hit?.key ?? "api_automation";
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? "";
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) ((best = v), (bestN = n));
  return best;
}

function clampBucket(n: number) {
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Phrase a starter task the same way the manual presets read: an imperative sentence. */
function phraseStarterTask(descriptions: string[], useCase: UseCaseKey, count: number): string {
  const common = mode(descriptions.map((d) => d.trim()).filter(Boolean));
  if (!common) return USE_CASES.find((u) => u.key === useCase)!.starterTask;
  const cleaned = common.replace(/\s+/g, " ").replace(/[.]+$/, "");
  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return `${sentence} — repeatable batch across ${count} historical runs`.slice(0, 200);
}

export function parseTaskHistoryCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { ok: false, error: "The file is empty or has no data rows." };

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}.` };
  }

  const idx = (c: string) => header.indexOf(c);
  const body = lines.slice(1);
  const truncated = body.length > MAX_ROWS;
  const rows: TaskRow[] = [];
  for (const line of body.slice(0, MAX_ROWS)) {
    const cells = splitCsvLine(line);
    if (cells.every((c) => c === "")) continue;
    rows.push({
      task_date: cells[idx("task_date")] ?? "",
      task_type: cells[idx("task_type")] ?? "",
      task_description: cells[idx("task_description")] ?? "",
      outcome: (cells[idx("outcome")] ?? "").toLowerCase(),
      duration_minutes: num(cells[idx("duration_minutes")]),
      cost_incurred: num(cells[idx("cost_incurred")]),
      revenue_generated: num(cells[idx("revenue_generated")]),
      vendor_used: cells[idx("vendor_used")] ?? "",
    });
  }

  if (rows.length < MIN_ROWS) {
    return {
      ok: false,
      error: `Only ${rows.length} usable row(s) found — at least ${MIN_ROWS} are required to derive a profile.`,
    };
  }

  return { ok: true, value: derive(rows, truncated) };
}

function derive(rows: TaskRow[], truncated: boolean): CsvDerivation {
  const successRows = rows.filter((r) => r.outcome.startsWith("succ"));
  const successes = successRows.length;
  const failures = rows.length - successes;
  const successRate = Math.round((successes / rows.length) * 1000) / 10;

  const revenues = successRows.map((r) => r.revenue_generated);
  const avgRevenue = revenues.length
    ? revenues.reduce((s, v) => s + v, 0) / revenues.length
    : 0;
  const variance = revenues.length
    ? revenues.reduce((s, v) => s + (v - avgRevenue) ** 2, 0) / revenues.length
    : 0;
  const cv = avgRevenue > 0 ? Math.sqrt(variance) / avgRevenue : 1;
  const revenueConsistency = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));

  const avgCost = rows.reduce((s, r) => s + r.cost_incurred, 0) / rows.length;
  const avgDuration = rows.reduce((s, r) => s + r.duration_minutes, 0) / rows.length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue_generated, 0);
  const costToRevenue = totalRevenue > 0 ? (avgCost * rows.length) / totalRevenue : 1;

  const times = rows
    .map((r) => Date.parse(r.task_date))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const spanDays =
    times.length >= 2 ? Math.max(1, (times[times.length - 1]! - times[0]!) / 86400000) : 1;
  const tasksPerDay = rows.length / spanDays;

  const frequency: Frequency = tasksPerDay >= 2 ? "high" : tasksPerDay >= 0.5 ? "medium" : "low";

  // Spend intensity — average cost per task, in the same 1..5 space the manual slider uses.
  const spendIntensity =
    avgCost < 75000 ? 1 : avgCost < 150000 ? 2 : avgCost < 250000 ? 3 : avgCost < 400000 ? 4 : 5;

  // Risk tolerance — failure rate plus how much of each rupee earned is spent to earn it.
  const failureRate = failures / rows.length;
  const riskIndex = failureRate * 6 + Math.min(1.2, costToRevenue) * 2.5;
  const riskTolerance = clampBucket(1 + riskIndex);

  const useCase = mapTaskType(mode(rows.map((r) => r.task_type)));
  const vendors = Array.from(
    new Set(rows.map((r) => r.vendor_used.trim()).filter(Boolean)),
  ).slice(0, 12);
  const starterTask = phraseStarterTask(
    rows.map((r) => r.task_description),
    useCase,
    rows.length,
  );

  const notes = [
    `Most frequent task type → ${USE_CASES.find((u) => u.key === useCase)!.label}`,
    `${successes}/${rows.length} tasks succeeded (${successRate}%)`,
    `Revenue consistency ${revenueConsistency}/100 (lower variance scores higher)`,
    `Avg spend ₹${Math.round(avgCost).toLocaleString("en-IN")} per task → intensity ${spendIntensity}/5`,
    `Failure rate ${(failureRate * 100).toFixed(1)}% + cost/revenue ${costToRevenue.toFixed(2)} → risk ${riskTolerance}/5`,
    `${tasksPerDay.toFixed(2)} tasks/day over ${Math.round(spanDays)}d → ${frequency} frequency`,
  ];
  if (truncated) notes.push(`File truncated to the first ${MAX_ROWS} rows for performance.`);

  return {
    useCase,
    frequency,
    riskTolerance,
    spendIntensity,
    starterTask,
    vendors,
    notes,
    stats: {
      rows: rows.length,
      truncated,
      successes,
      failures,
      successRate,
      avgRevenue: Math.round(avgRevenue),
      avgCost: Math.round(avgCost),
      avgDuration: Math.round(avgDuration),
      revenueVariance: Math.round(variance),
      revenueConsistency,
      costToRevenue: Math.round(costToRevenue * 100) / 100,
      spanDays: Math.round(spanDays),
      tasksPerDay: Math.round(tasksPerDay * 100) / 100,
    },
  };
}

export const SAMPLE_CSV_HEADER = REQUIRED_COLUMNS.join(",");
