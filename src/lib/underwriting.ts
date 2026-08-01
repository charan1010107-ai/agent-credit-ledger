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
  const rate = Math.round((4 + (800 - projected) * 0.028) * 100) / 100;

  return { projected, approved, factors, topFactors: top, rate: Math.max(3.5, rate), coverage };
}
