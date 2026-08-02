/** Pure underwriting model — safe to import on both client and server. */

export type ScoreFactor = { label: string; value: number };

export type UnderwritableAgent = {
  status: string;
  credit_limit: number;
  score_factors: ScoreFactor[];
};

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

  factors.push({
    label: "Revenue coverage ratio",
    value: Math.round(Math.min(30, (coverage - 1) * 40)),
  });
  factors.push({
    label: "Requested utilization",
    value: Math.round(-utilization * 34),
  });

  const delta = factors.reduce((s, f) => s + f.value, 0);
  const projected = Math.max(300, Math.min(850, Math.round(560 + delta)));
  const approved =
    agent.status !== "frozen" &&
    projected >= 600 &&
    amount <= Number(agent.credit_limit) &&
    coverage >= 1.1;

  const top = [...factors].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const { tier, rate } = rateForScore(projected);

  return { projected, approved, factors, topFactors: top, rate, tier, coverage };
}
