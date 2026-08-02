/** Deterministic, explainable agent bootstrapping used by the personal onboarding flow.
 *  Pure module — safe to import on client and server. */

import { rateForScore, type ScoreFactor } from "./underwriting";

export type Frequency = "low" | "medium" | "high";

export type UseCaseKey =
  | "data_scraping"
  | "trading_execution"
  | "content_generation"
  | "logistics_optimization"
  | "api_automation";

export type UseCase = {
  key: UseCaseKey;
  label: string;
  blurb: string;
  starterTask: string;
  /** Neutral behavioural assumptions for a brand-new agent in this domain. */
  successRate: number;
  completionMinutes: number;
  spendConsistency: number;
  /** Typical working-capital need for the starter task, in ₹. */
  taskCost: number;
  /** Expected revenue multiple on the task cost. */
  revenueMultiple: number;
  vendors: string[];
  scope: string;
};

export const USE_CASES: UseCase[] = [
  {
    key: "data_scraping",
    label: "Data Scraping",
    blurb: "Harvest and structure public web data at scale.",
    starterTask: "Scrape and structure pricing data from 500 e-commerce listings",
    successRate: 91,
    completionMinutes: 34,
    spendConsistency: 82,
    taskCost: 180000,
    revenueMultiple: 1.55,
    vendors: ["proxy-mesh", "scrapeops", "s3-storage"],
    scope: "Web data extraction, normalisation and delivery",
  },
  {
    key: "trading_execution",
    label: "Trading Execution",
    blurb: "Execute rules-based orders across venues with tight slippage.",
    starterTask: "Execute a ₹4L rules-based rebalancing programme across 3 venues",
    successRate: 86,
    completionMinutes: 12,
    spendConsistency: 68,
    taskCost: 320000,
    revenueMultiple: 1.34,
    vendors: ["market-data-api", "exchange-gateway", "risk-engine"],
    scope: "Algorithmic order execution within venue whitelist",
  },
  {
    key: "content_generation",
    label: "Content Generation",
    blurb: "Produce briefed long-form and campaign content on schedule.",
    starterTask: "Produce 40 briefed long-form articles with sourcing and QA passes",
    successRate: 94,
    completionMinutes: 46,
    spendConsistency: 88,
    taskCost: 140000,
    revenueMultiple: 1.62,
    vendors: ["llm-gateway", "image-gen", "cms-api"],
    scope: "Briefed content production, editing and publishing",
  },
  {
    key: "logistics_optimization",
    label: "Logistics Optimization",
    blurb: "Re-plan routes and loads against live constraints.",
    starterTask: "Re-optimise 1,200 delivery routes against live traffic and load constraints",
    successRate: 89,
    completionMinutes: 27,
    spendConsistency: 85,
    taskCost: 260000,
    revenueMultiple: 1.48,
    vendors: ["maps-api", "telematics", "fleet-erp"],
    scope: "Route and load optimisation for delivery fleets",
  },
  {
    key: "api_automation",
    label: "API Automation",
    blurb: "Run cross-system workflows and reconciliations unattended.",
    starterTask: "Automate 10k cross-system reconciliation calls with retry and audit trail",
    successRate: 92,
    completionMinutes: 19,
    spendConsistency: 90,
    taskCost: 160000,
    revenueMultiple: 1.44,
    vendors: ["workflow-runner", "webhook-relay", "audit-log"],
    scope: "Unattended API workflow execution and reconciliation",
  },
];

export function useCaseFor(key: string): UseCase {
  return USE_CASES.find((u) => u.key === key) ?? USE_CASES[0]!;
}

export type OnboardingInput = {
  agentName: string;
  useCase: UseCaseKey;
  frequency: Frequency;
  /** 1 (conservative) … 5 (aggressive) */
  riskTolerance: number;
  /** 1 (frugal) … 5 (heavy) */
  spendIntensity: number;
};

const FREQUENCY_POINTS: Record<Frequency, number> = { low: -6, medium: 6, high: 14 };
const FREQUENCY_LABEL: Record<Frequency, string> = {
  low: "Low task frequency",
  medium: "Medium task frequency",
  high: "High task frequency",
};

/** Score→limit ladder shared with the rest of the protocol (₹). */
export function creditLimitForScore(score: number): number {
  const raw = (score - 450) * 1500;
  const clamped = Math.max(75000, Math.min(900000, raw));
  return Math.round(clamped / 1000) * 1000;
}

/** Deterministic starting profile for a brand-new agent — no history, so we anchor on
 *  the use case's neutral behavioural assumptions and adjust by the operator's inputs. */
export function deriveStartingProfile(input: OnboardingInput) {
  const uc = useCaseFor(input.useCase);
  const risk = Math.min(5, Math.max(1, Math.round(input.riskTolerance)));
  const spend = Math.min(5, Math.max(1, Math.round(input.spendIntensity)));

  const successRate = Math.round(Math.max(60, uc.successRate - (risk - 3) * 3));
  const spendConsistency = Math.round(Math.max(45, uc.spendConsistency - (spend - 3) * 6));
  const completionMinutes = Math.round(uc.completionMinutes * (1 + (3 - risk) * 0.05));

  const factors: ScoreFactor[] = [
    { label: `${uc.label} baseline reliability`, value: Math.round((successRate - 80) * 2.2) },
    { label: "Spend consistency assumption", value: Math.round((spendConsistency - 70) * 1.1) },
    { label: FREQUENCY_LABEL[input.frequency], value: FREQUENCY_POINTS[input.frequency] },
    { label: "Risk tolerance setting", value: (3 - risk) * 8 },
    { label: "Spend intensity setting", value: (3 - spend) * 7 },
    { label: "No repayment history yet", value: -18 },
  ];

  const score = Math.max(300, Math.min(850, 620 + factors.reduce((s, f) => s + f.value, 0)));
  const creditLimit = creditLimitForScore(score);
  const spendCap = Math.round((creditLimit * (0.4 + spend * 0.08)) / 1000) * 1000;
  const suggestedLoan =
    Math.round(Math.min(uc.taskCost, creditLimit * 0.7) / 1000) * 1000 || 50000;
  const estimatedReturn =
    Math.round((suggestedLoan * uc.revenueMultiple * (1 + (risk - 3) * 0.04)) / 1000) * 1000;
  const { tier, rate } = rateForScore(score);

  return {
    useCase: uc,
    score,
    factors,
    creditLimit,
    spendCap,
    suggestedLoan,
    estimatedReturn,
    rate,
    tier,
    successRate,
    spendConsistency,
    completionMinutes,
  };
}

export function useCaseFromVendors(vendors: string[] | null | undefined): UseCase {
  const first = (vendors ?? [])[0];
  return USE_CASES.find((u) => u.vendors[0] === first) ?? USE_CASES[0]!;
}

/** Re-derives the starter loan plan from stored agent data so every surface agrees. */
export function starterPlanFromAgent(agent: {
  vendor_whitelist: string[];
  credit_limit: number;
  baseline_credit_limit: number | null;
  task_scope: string;
}) {
  const uc = useCaseFromVendors(agent.vendor_whitelist);
  const limit = Number(agent.baseline_credit_limit ?? agent.credit_limit);
  const suggestedLoan = Math.round(Math.min(uc.taskCost, limit * 0.7) / 1000) * 1000 || 50000;
  const estimatedReturn = Math.round((suggestedLoan * uc.revenueMultiple) / 1000) * 1000;
  return { useCase: uc, suggestedLoan, estimatedReturn, starterTask: agent.task_scope || uc.starterTask };
}
