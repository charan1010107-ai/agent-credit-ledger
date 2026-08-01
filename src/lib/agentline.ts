import { supabase } from "@/integrations/supabase/client";

export type AgentStatus = "none" | "active" | "repaying" | "frozen";

export type ScoreFactor = { label: string; value: number };

export type Principal = {
  id: string;
  name: string;
  entity_type: string;
  jurisdiction: string;
  reputation_score: number;
  signature_hash: string;
  signed_at: string;
};

export type Agent = {
  id: string;
  name: string;
  principal_id: string;
  wallet_address: string;
  credit_score: number;
  credit_limit: number;
  status: string;
  task_scope: string;
  spend_cap: number;
  wallet_balance: number;
  task_success_rate: number;
  avg_completion_minutes: number;
  spend_consistency: number;
  anomaly: boolean;
  anomaly_reason: string | null;
  frozen_at: string | null;
  freeze_reason: string | null;
  vendor_whitelist: string[];
  score_factors: ScoreFactor[];
  recent_task_revenue: number[];
  spend_velocity: number[];
  created_at: string;
  principals?: Principal | null;
};

export type Loan = {
  id: string;
  agent_id: string;
  amount: number;
  interest_rate: number;
  task_description: string;
  expected_revenue: number;
  expected_repayment_date: string | null;
  status: string;
  decision_reasons: string[];
  disbursed_at: string | null;
  repaid_at: string | null;
  created_at: string;
  agents?: { name: string } | null;
};

export type Transaction = {
  id: string;
  agent_id: string | null;
  loan_id: string | null;
  tx_hash: string;
  tx_type: string;
  amount: number;
  status: string;
  memo: string | null;
  created_at: string;
  agents?: { name: string } | null;
};

export type ScorePoint = { id: string; agent_id: string; score: number; recorded_at: string };

const cast = <T,>(rows: unknown): T[] => (rows ?? []) as T[];

export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, principals(*)")
    .order("credit_score", { ascending: false });
  if (error) throw error;
  return cast<Agent>(data);
}

export async function fetchAgent(id: string): Promise<Agent> {
  const { data, error } = await supabase
    .from("agents")
    .select("*, principals(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Agent not found");
  return data as unknown as Agent;
}

export async function fetchLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select("*, agents(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return cast<Loan>(data);
}

export async function fetchTransactions(limit = 40): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, agents(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return cast<Transaction>(data);
}

export async function fetchScoreHistory(agentId: string): Promise<ScorePoint[]> {
  const { data, error } = await supabase
    .from("score_history")
    .select("*")
    .eq("agent_id", agentId)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return cast<ScorePoint>(data);
}

/* ---------- domain helpers ---------- */

const HEX = "0123456789abcdef";
export function txHash(): string {
  let out = "0x";
  for (let i = 0; i < 40; i++) out += HEX[Math.floor(Math.random() * 16)];
  return out;
}

export function scoreColor(score: number): string {
  if (score >= 760) return "text-success";
  if (score >= 680) return "text-cyan";
  if (score >= 580) return "text-warning";
  return "text-destructive";
}

export function scoreBand(score: number): string {
  if (score >= 760) return "PRIME";
  if (score >= 680) return "STANDARD";
  if (score >= 580) return "WATCH";
  return "SUBPRIME";
}

export function statusTone(status: string): { label: string; className: string } {
  switch (status) {
    case "active":
      return { label: "Active", className: "border-primary/50 bg-primary/12 text-primary" };
    case "repaying":
      return { label: "Repaying", className: "border-violet/50 bg-violet/12 text-violet" };
    case "frozen":
      return {
        label: "Frozen",
        className: "border-destructive/60 bg-destructive/15 text-destructive",
      };
    case "repaid":
      return { label: "Repaid", className: "border-success/50 bg-success/12 text-success" };
    case "defaulted":
      return {
        label: "Defaulted",
        className: "border-destructive/60 bg-destructive/15 text-destructive",
      };
    default:
      return { label: "None", className: "border-border bg-muted/40 text-muted-foreground" };
  }
}

export function money(n: number, digits = 0): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** Deterministic underwriting model used by the loan flow. */
export function underwrite(agent: Agent, amount: number, expectedRevenue: number) {
  const factors: ScoreFactor[] = [...agent.score_factors];
  const coverage = expectedRevenue > 0 ? expectedRevenue / Math.max(amount, 1) : 0;
  const utilization = amount / Math.max(agent.credit_limit, 1);

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
    agent.status !== "frozen" && projected >= 600 && amount <= agent.credit_limit && coverage >= 1.1;

  const top = [...factors].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const rate = Math.round((4 + (800 - projected) * 0.028) * 100) / 100;

  return { projected, approved, factors, topFactors: top, rate: Math.max(3.5, rate), coverage };
}
