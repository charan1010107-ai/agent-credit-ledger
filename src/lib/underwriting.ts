/** Pure underwriting model — safe to import on both client and server. */

export type ScoreFactor = { label: string; value: number };

export type UnderwritableAgent = {
  status: string;
  credit_limit: number;
  score_factors: ScoreFactor[];
  /** The agent's standing score — the anchor every request is scored against. */
  credit_score?: number;
};

/**
 * Anchor score for a request. Uses the agent's own standing score when it has one
 * (newly issued agents are scored at creation), falling back to the generic
 * 560 + baseline-factors anchor for legacy rows without a stored score.
 */
function anchorScore(agent: UnderwritableAgent): number {
  const stored = Number(agent.credit_score);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return 560 + (agent.score_factors ?? []).reduce((s, f) => s + f.value, 0);
}

const HEX = "0123456789abcdef";

export function txHash(): string {
  let out = "0x";
  for (let i = 0; i < 40; i++) out += HEX[Math.floor(Math.random() * 16)];
  return out;
}

export type RateTier = {
  key: "prime" | "standard" | "watch" | "subprime";
  label: string;
  range: string;
  min: number;
  max: number;
  rateFloor: number;
  rateCeiling: number;
  tone: string;
};

/** Tiered pricing: the better the behavioural score, the cheaper the capital. */
export const RATE_TIERS: RateTier[] = [
  {
    key: "prime",
    label: "Tier 1 · Prime",
    range: "750–850",
    min: 750,
    max: 850,
    rateFloor: 6,
    rateCeiling: 8,
    tone: "text-success",
  },
  {
    key: "standard",
    label: "Tier 2 · Standard",
    range: "650–749",
    min: 650,
    max: 749,
    rateFloor: 10,
    rateCeiling: 14,
    tone: "text-cyan",
  },
  {
    key: "watch",
    label: "Tier 3 · Watch",
    range: "550–649",
    min: 550,
    max: 649,
    rateFloor: 16,
    rateCeiling: 20,
    tone: "text-warning",
  },
  {
    key: "subprime",
    label: "Tier 4 · High risk",
    range: "below 550",
    min: 0,
    max: 549,
    rateFloor: 24,
    rateCeiling: 28,
    tone: "text-destructive",
  },
];

/** Interest rate derived directly from the credit score — linear inside each tier. */
export function rateForScore(score: number): { tier: RateTier; rate: number } {
  const tier = RATE_TIERS.find((t) => score >= t.min && score <= t.max) ?? RATE_TIERS[3]!;
  const span = Math.max(1, tier.max - tier.min);
  const position = Math.min(1, Math.max(0, (score - tier.min) / span));
  // Higher score inside the tier ⇒ closer to the tier's floor rate.
  const rate = tier.rateCeiling - position * (tier.rateCeiling - tier.rateFloor);
  return { tier, rate: Math.round(rate * 100) / 100 };
}

/** Deterministic underwriting model used by the loan flow (client preview + server of record). */
export function underwrite(agent: UnderwritableAgent, amount: number, expectedRevenue: number) {
  const factors: ScoreFactor[] = [...(agent.score_factors ?? [])];
  const coverage = expectedRevenue > 0 ? expectedRevenue / Math.max(amount, 1) : 0;
  const utilization = amount / Math.max(Number(agent.credit_limit), 1);

  const requestFactors: ScoreFactor[] = [
    {
      label: "Revenue coverage ratio",
      value: Math.round(Math.min(30, (coverage - 1) * 40)),
    },
    {
      label: "Requested utilization",
      value: Math.round(-utilization * 34),
    },
  ];
  factors.push(...requestFactors);

  // The standing score already prices the baseline factors; only the request-specific
  // factors move it. Anchoring on a flat 560 made freshly issued agents undecidable.
  const delta = requestFactors.reduce((s, f) => s + f.value, 0);
  const projected = Math.max(300, Math.min(850, Math.round(anchorScore(agent) + delta)));
  const approved =
    agent.status !== "frozen" &&
    projected >= 600 &&
    amount <= Number(agent.credit_limit) &&
    coverage >= 1.1;

  const top = [...factors].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const { tier, rate } = rateForScore(projected);

  return { projected, approved, factors, topFactors: top, rate, tier, coverage };
}

/* ------------------------- custom (user-defined) use cases ------------------------- */

export type BehavioralAgent = UnderwritableAgent & {
  credit_score: number;
  task_success_rate: number;
  spend_consistency: number;
  recent_task_revenue: number[];
  principals?: { reputation_score: number } | null;
};

export type CustomRequest = {
  /** Free-text name the operator gave this use case. */
  name: string;
  amount: number;
  expectedRevenue: number;
  /** Expected completion timeframe, normalised to days. */
  timeframeDays: number;
};

/**
 * Underwrites a use case the protocol has never seen for this agent. There is no
 * category template to lean on, so the behavioural inputs come from the agent's own
 * track record (success rate, revenue consistency, spend pattern, principal reputation).
 * A brand-new agent with no history falls back to the neutral anchor used at creation,
 * adjusted by the expected revenue and timeframe the operator entered.
 */
export function underwriteCustom(agent: BehavioralAgent, req: CustomRequest) {
  const history = agent.recent_task_revenue ?? [];
  const hasHistory = history.length > 0;

  const coverage = req.expectedRevenue > 0 ? req.expectedRevenue / Math.max(req.amount, 1) : 0;
  const utilization = req.amount / Math.max(Number(agent.credit_limit), 1);

  const factors: ScoreFactor[] = [];
  const notes: string[] = [];

  if (hasHistory) {
    const mean = history.reduce((s, v) => s + v, 0) / history.length;
    const variance = history.reduce((s, v) => s + (v - mean) ** 2, 0) / history.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    factors.push({
      label: "General task success rate",
      value: Math.round((Number(agent.task_success_rate) - 85) * 1.8),
    });
    factors.push({
      label: "Past revenue consistency",
      value: Math.round(Math.max(-25, Math.min(22, (0.35 - cv) * 70))),
    });
    factors.push({
      label: "Historical spend discipline",
      value: Math.round((Number(agent.spend_consistency) - 75) * 0.9),
    });
    notes.push(
      `First-time use case "${req.name}" for this agent — no category-specific history exists, so the score leans on the agent's general track record (${history.length} settled tasks) and principal reputation.`,
    );
  } else {
    factors.push({ label: "No task history — neutral anchor", value: -14 });
    factors.push({
      label: "Creation-time behavioural assumptions",
      value: Math.round((Number(agent.task_success_rate) - 88) * 1.2),
    });
    notes.push(
      `New agent with no settled tasks — falling back to the neutral scoring used at agent creation, adjusted by the expected revenue and ${req.timeframeDays}-day timeframe you entered.`,
    );
  }

  const reputation = Number(agent.principals?.reputation_score ?? 700);
  factors.push({
    label: "Principal reputation",
    value: Math.round((reputation - 700) / 8),
  });
  factors.push({
    label: "Revenue coverage ratio",
    value: Math.round(Math.min(30, (coverage - 1) * 40)),
  });
  factors.push({ label: "Requested utilization", value: Math.round(-utilization * 34) });
  factors.push({
    label: "Expected completion timeframe",
    value: req.timeframeDays <= 7 ? 8 : req.timeframeDays <= 21 ? 2 : -9,
  });
  factors.push({ label: "Unproven use-case category", value: -10 });

  const delta = factors.reduce((s, f) => s + f.value, 0);
  const projected = Math.max(300, Math.min(850, Math.round(anchorScore(agent) + delta)));
  const { tier, rate } = rateForScore(projected);
  const top = [...factors].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);

  // Score-supported exposure, always capped by the agent's overall limit.
  // A scoring-eligible agent must always be able to draw something — never ₹0.
  const scoreEligible = agent.status !== "frozen" && projected >= 600;
  const supportRatio = Math.max(scoreEligible ? 0.15 : 0, Math.min(1, (projected - 520) / 300));
  const round1k = (v: number) => Math.max(1000, Math.round(v / 1000) * 1000);
  const scoreSupported = round1k(Number(agent.credit_limit) * supportRatio);
  const coverageCap =
    coverage > 0 ? round1k(req.expectedRevenue / 1.1 / (1 + rate / 100)) : 0;
  const maxAmount = Math.max(
    0,
    Math.min(Number(agent.credit_limit), scoreSupported, coverageCap || scoreSupported),
  );

  const eligible = scoreEligible && maxAmount >= 1000;
  const approved = eligible && req.amount <= maxAmount;
  const partial = eligible && !approved;


  return {
    projected,
    approved,
    partial,
    maxAmount,
    approvedAmount: approved ? req.amount : maxAmount,
    factors,
    topFactors: top,
    rate,
    tier,
    coverage,
    hasHistory,
    notes,
  };
}
