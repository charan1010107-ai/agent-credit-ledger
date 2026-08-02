// Server-only write path for AgentLine. All financial mutations happen here with the
// privileged client, after the values are recomputed from the database — never trusted
// from the browser. The public Data API is read-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { txHash, underwrite, underwriteCustom, type ScoreFactor } from "./underwriting";
import { nextStage, stageMeta, type RiskStage } from "./risk";

type AgentRow = {
  id: string;
  name: string;
  status: string;
  credit_limit: number;
  credit_score: number;
  wallet_balance: number;
  vendor_whitelist: string[];
  score_factors: ScoreFactor[];
  risk_stage: string;
  risk_signals: number;
  baseline_credit_limit: number | null;
  task_success_rate: number;
  spend_consistency: number;
  recent_task_revenue: number[];
  principals: { reputation_score: number } | null;
};

async function loadAgent(agentId: string): Promise<AgentRow> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select(
      "id, name, status, credit_limit, credit_score, wallet_balance, vendor_whitelist, score_factors, risk_stage, risk_signals, baseline_credit_limit, task_success_rate, spend_consistency, recent_task_revenue, principals(reputation_score)",
    )
    .eq("id", agentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load agent");
  if (!data) throw new Error("Agent not found");
  return data as unknown as AgentRow;
}

export async function disburseLoan(input: {
  agentId: string;
  amount: number;
  expectedRevenue: number;
  taskDescription: string;
  dueDate: string;
  custom?: { name: string; vendors: string[]; timeframeDays: number } | undefined;
}) {
  const agent = await loadAgent(input.agentId);

  // Re-run underwriting server-side: the browser's decision is only a preview.
  // Custom (user-defined) use cases are scored off the agent's own track record.
  const custom = input.custom;
  const decision = custom
    ? underwriteCustom(agent, {
        name: custom.name,
        amount: input.amount,
        expectedRevenue: input.expectedRevenue,
        timeframeDays: custom.timeframeDays,
      })
    : underwrite(agent, input.amount, input.expectedRevenue);

  const amount = custom
    ? Math.min(input.amount, (decision as ReturnType<typeof underwriteCustom>).maxAmount)
    : input.amount;

  const ok = custom
    ? (decision as ReturnType<typeof underwriteCustom>).approved ||
      ((decision as ReturnType<typeof underwriteCustom>).partial && amount >= 1000)
    : decision.approved;
  if (!ok) throw new Error("Loan declined by underwriting");

  const description = custom
    ? `[${custom.name}] ${input.taskDescription}`
    : input.taskDescription;

  const reasons = decision.topFactors.map(
    (f) => `${f.value >= 0 ? "+" : ""}${f.value} ${f.label.toLowerCase()}`,
  );
  if (custom) {
    const d = decision as ReturnType<typeof underwriteCustom>;
    reasons.push(...d.notes);
    if (d.partial) {
      reasons.push(
        `Partial approval — score ${d.projected} supports ₹${d.maxAmount.toLocaleString("en-IN")} of the ₹${input.amount.toLocaleString("en-IN")} requested`,
      );
    }
  }

  const hash = txHash();
  const { data: loan, error } = await supabaseAdmin
    .from("loans")
    .insert({
      agent_id: agent.id,
      amount,
      interest_rate: decision.rate,
      task_description: description,
      expected_revenue: input.expectedRevenue,
      expected_repayment_date: input.dueDate,
      status: "active",
      decision_reasons: reasons,
      disbursed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !loan) throw new Error("Unable to create loan");

  const whitelist =
    custom && custom.vendors.length > 0 ? custom.vendors : (agent.vendor_whitelist ?? []);

  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    loan_id: loan.id,
    tx_hash: hash,
    tx_type: "disbursement",
    amount,
    status: "confirmed",
    memo: `Scoped wallet funded${custom ? ` for custom use case "${custom.name}"` : ""} — whitelist: ${whitelist.join(", ")}`,
  });
  if (txError) throw new Error("Unable to record disbursement");

  // Custom vendors are folded into the agent's whitelist so the wallet policy layer allows them.
  const mergedWhitelist = Array.from(
    new Set([...(agent.vendor_whitelist ?? []), ...(custom?.vendors ?? [])]),
  );

  const { error: agentError } = await supabaseAdmin
    .from("agents")
    .update({
      status: "active",
      wallet_balance: Number(agent.wallet_balance) + amount,
      credit_score: decision.projected,
      vendor_whitelist: mergedWhitelist,
    })
    .eq("id", agent.id);
  if (agentError) throw new Error("Unable to update agent wallet");

  await supabaseAdmin
    .from("score_history")
    .insert({ agent_id: agent.id, score: decision.projected });

  return {
    id: loan.id as string,
    hash,
    amount,
    partial: custom ? (decision as ReturnType<typeof underwriteCustom>).partial : false,
  };
}

export async function freezeAgent(agentId: string) {
  const { data: agent, error: loadError } = await supabaseAdmin
    .from("agents")
    .select("id, name, anomaly_reason, risk_stage")
    .eq("id", agentId)
    .maybeSingle();
  if (loadError) throw new Error("Unable to load agent");
  if (!agent) throw new Error("Agent not found");

  const reason =
    agent.anomaly_reason ?? "Manual revocation by risk operator — policy breach suspected";

  const { error } = await supabaseAdmin
    .from("agents")
    .update({
      status: "frozen",
      wallet_balance: 0,
      frozen_at: new Date().toISOString(),
      freeze_reason: reason,
      risk_stage: "frozen",
      risk_reason: reason,
      risk_stage_at: new Date().toISOString(),
      risk_signals: 3,
      anomaly: true,
    })
    .eq("id", agent.id);
  if (error) throw new Error("Unable to freeze agent");

  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    tx_hash: txHash(),
    tx_type: "revocation",
    amount: 0,
    status: "flagged",
    memo: `ACCESS REVOKED — ${reason}`,
  });
  if (txError) throw new Error("Unable to log revocation");

  await supabaseAdmin
    .from("loans")
    .update({ status: "frozen" })
    .eq("agent_id", agent.id)
    .in("status", ["active", "repaying"]);

  return { name: agent.name as string };
}

export async function unfreezeAgent(agentId: string) {
  const { data: agent, error: loadError } = await supabaseAdmin
    .from("agents")
    .select("id, name, baseline_credit_limit")
    .eq("id", agentId)
    .maybeSingle();
  if (loadError) throw new Error("Unable to load agent");
  if (!agent) throw new Error("Agent not found");

  const { error } = await supabaseAdmin
    .from("agents")
    .update({
      status: "none",
      frozen_at: null,
      freeze_reason: null,
      risk_stage: "healthy",
      risk_reason: null,
      risk_stage_at: new Date().toISOString(),
      risk_signals: 0,
      anomaly: false,
      anomaly_reason: null,
      ...(agent.baseline_credit_limit != null
        ? { credit_limit: Number(agent.baseline_credit_limit) }
        : {}),
    })
    .eq("id", agent.id);
  if (error) throw new Error("Unable to reinstate agent");

  await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    tx_hash: txHash(),
    tx_type: "reinstatement",
    amount: 0,
    status: "confirmed",
    memo: "Access reinstated after operator review",
  });

  return { name: agent.name as string };
}

export async function settleLoan(loanId: string) {
  const { data: loan, error: loanLoadError } = await supabaseAdmin
    .from("loans")
    .select("id, agent_id, amount, interest_rate, expected_revenue, task_description, status")
    .eq("id", loanId)
    .maybeSingle();
  if (loanLoadError) throw new Error("Unable to load loan");
  if (!loan) throw new Error("Loan not found");
  if (!["active", "repaying"].includes(loan.status as string)) {
    throw new Error("Loan is not open for settlement");
  }

  const agent = await loadAgent(loan.agent_id as string);

  const revenue = Number(loan.expected_revenue);
  const repayment = Math.round(Number(loan.amount) * (1 + Number(loan.interest_rate) / 100));
  const surplus = Math.max(0, revenue - repayment);
  const before = Number(agent.wallet_balance);
  const after = before + surplus;

  const { error: txError } = await supabaseAdmin.from("transactions").insert([
    {
      agent_id: agent.id,
      loan_id: loan.id,
      tx_hash: txHash(),
      tx_type: "task_revenue",
      amount: revenue,
      status: "confirmed",
      memo: `Task completed — revenue captured into escrow: ${loan.task_description}`,
    },
    {
      agent_id: agent.id,
      loan_id: loan.id,
      tx_hash: txHash(),
      tx_type: "repayment",
      amount: -repayment,
      status: "confirmed",
      memo: `Principal + ${Number(loan.interest_rate).toFixed(2)}% interest routed to lender`,
    },
    {
      agent_id: agent.id,
      loan_id: loan.id,
      tx_hash: txHash(),
      tx_type: "surplus_release",
      amount: surplus,
      status: "confirmed",
      memo: "Surplus released to agent wallet",
    },
  ]);
  if (txError) throw new Error("Unable to record settlement");

  const { error: loanError } = await supabaseAdmin
    .from("loans")
    .update({ status: "repaid", repaid_at: new Date().toISOString() })
    .eq("id", loan.id);
  if (loanError) throw new Error("Unable to close loan");

  const newScore = Math.min(850, Number(agent.credit_score) + 6);
  // Fold this task's outcome back into the agent's behavioural history so future
  // requests — including future custom use cases — are scored on it.
  const revenueHistory = [...(agent.recent_task_revenue ?? []), revenue].slice(-12);
  const priorTasks = (agent.recent_task_revenue ?? []).length;
  const successRate =
    Math.round(((Number(agent.task_success_rate) * priorTasks + 100) / (priorTasks + 1)) * 10) / 10;

  const { error: agentError } = await supabaseAdmin
    .from("agents")
    .update({
      wallet_balance: after,
      credit_score: newScore,
      recent_task_revenue: revenueHistory,
      task_success_rate: successRate,
      status: agent.status === "frozen" ? "frozen" : "none",
    })
    .eq("id", agent.id);
  if (agentError) throw new Error("Unable to update agent wallet");

  await supabaseAdmin.from("score_history").insert({ agent_id: agent.id, score: newScore });

  return {
    agentName: agent.name,
    rate: Number(loan.interest_rate),
    revenue,
    repayment,
    interest: repayment - Number(loan.amount),
    principal: Number(loan.amount),
    surplus,
    before,
    after,
  };
}


/**
 * Graduated risk response. Each call moves the agent one stage along
 * healthy → warning → throttled → frozen and logs the transition.
 */
export async function escalateRisk(agentId: string, reasonInput?: string) {
  const agent = await loadAgent(agentId);
  const from = (agent.risk_stage ?? "healthy") as RiskStage;
  if (from === "frozen") throw new Error("Agent is already frozen");

  const to = nextStage(from);
  if (to === "frozen") {
    const res = await freezeAgent(agentId);
    return { name: res.name, from, to, reason: "Access revoked after continued anomalies" };
  }

  const baseline = Number(agent.baseline_credit_limit ?? agent.credit_limit);
  const reason =
    reasonInput?.trim() ||
    (to === "warning"
      ? "Minor anomaly — failed task / spend spike above baseline"
      : "Anomaly persisted — spend velocity crossed the throttle threshold");

  const newLimit = to === "throttled" ? Math.round(baseline * 0.5) : Number(agent.credit_limit);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("agents")
    .update({
      risk_stage: to,
      risk_reason: reason,
      risk_stage_at: now,
      risk_signals: Number(agent.risk_signals ?? 0) + 1,
      anomaly: true,
      anomaly_reason: reason,
      baseline_credit_limit: baseline,
      credit_limit: newLimit,
    })
    .eq("id", agent.id);
  if (error) throw new Error("Unable to update risk stage");

  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    tx_hash: txHash(),
    tx_type: to === "warning" ? "risk_warning" : "risk_throttle",
    amount: 0,
    status: "flagged",
    memo:
      to === "warning"
        ? `WARNING RAISED — ${reason}`
        : `THROTTLED — ${reason}. Credit limit cut to ₹${newLimit.toLocaleString("en-IN")}`,
  });
  if (txError) throw new Error("Unable to log risk transition");

  return { name: agent.name, from, to, reason, newLimit, stage: stageMeta(to).label };
}

/** Step an agent back down one stage (operator review cleared the signal). */
export async function deescalateRisk(agentId: string) {
  const agent = await loadAgent(agentId);
  const from = (agent.risk_stage ?? "healthy") as RiskStage;
  if (from === "healthy") throw new Error("Agent is already healthy");
  if (from === "frozen") return unfreezeAgent(agentId);

  const to: RiskStage = from === "throttled" ? "warning" : "healthy";
  const baseline = Number(agent.baseline_credit_limit ?? agent.credit_limit);

  const { error } = await supabaseAdmin
    .from("agents")
    .update({
      risk_stage: to,
      risk_reason: to === "healthy" ? null : "Downgraded to warning after operator review",
      risk_stage_at: new Date().toISOString(),
      risk_signals: Math.max(0, Number(agent.risk_signals ?? 0) - 1),
      anomaly: to !== "healthy",
      anomaly_reason: to === "healthy" ? null : "Downgraded to warning after operator review",
      credit_limit: baseline,
    })
    .eq("id", agent.id);
  if (error) throw new Error("Unable to update risk stage");

  await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    tx_hash: txHash(),
    tx_type: "risk_clear",
    amount: 0,
    status: "confirmed",
    memo: `Risk stage stepped down ${from} → ${to} after operator review`,
  });

  return { name: agent.name, from, to };
}
