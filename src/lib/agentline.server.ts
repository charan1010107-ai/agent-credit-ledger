// Server-only write path for AgentLine. All financial mutations happen here with the
// privileged client, after the values are recomputed from the database — never trusted
// from the browser. The public Data API is read-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { txHash, underwrite, type ScoreFactor } from "./underwriting";

type AgentRow = {
  id: string;
  name: string;
  status: string;
  credit_limit: number;
  credit_score: number;
  wallet_balance: number;
  vendor_whitelist: string[];
  score_factors: ScoreFactor[];
};

async function loadAgent(agentId: string): Promise<AgentRow> {
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("id, name, status, credit_limit, credit_score, wallet_balance, vendor_whitelist, score_factors")
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
}) {
  const agent = await loadAgent(input.agentId);

  // Re-run underwriting server-side: the browser's decision is only a preview.
  const decision = underwrite(agent, input.amount, input.expectedRevenue);
  if (!decision.approved) throw new Error("Loan declined by underwriting");

  const hash = txHash();
  const { data: loan, error } = await supabaseAdmin
    .from("loans")
    .insert({
      agent_id: agent.id,
      amount: input.amount,
      interest_rate: decision.rate,
      task_description: input.taskDescription,
      expected_revenue: input.expectedRevenue,
      expected_repayment_date: input.dueDate,
      status: "active",
      decision_reasons: decision.topFactors.map(
        (f) => `${f.value >= 0 ? "+" : ""}${f.value} ${f.label.toLowerCase()}`,
      ),
      disbursed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !loan) throw new Error("Unable to create loan");

  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id,
    loan_id: loan.id,
    tx_hash: hash,
    tx_type: "disbursement",
    amount: input.amount,
    status: "confirmed",
    memo: `Scoped wallet funded — whitelist: ${(agent.vendor_whitelist ?? []).join(", ")}`,
  });
  if (txError) throw new Error("Unable to record disbursement");

  const { error: agentError } = await supabaseAdmin
    .from("agents")
    .update({
      status: "active",
      wallet_balance: Number(agent.wallet_balance) + input.amount,
      credit_score: decision.projected,
    })
    .eq("id", agent.id);
  if (agentError) throw new Error("Unable to update agent wallet");

  await supabaseAdmin
    .from("score_history")
    .insert({ agent_id: agent.id, score: decision.projected });

  return { id: loan.id as string, hash };
}

export async function freezeAgent(agentId: string) {
  const { data: agent, error: loadError } = await supabaseAdmin
    .from("agents")
    .select("id, name, anomaly_reason")
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
    .select("id, name")
    .eq("id", agentId)
    .maybeSingle();
  if (loadError) throw new Error("Unable to load agent");
  if (!agent) throw new Error("Agent not found");

  const { error } = await supabaseAdmin
    .from("agents")
    .update({ status: "none", frozen_at: null, freeze_reason: null })
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
  const { error: agentError } = await supabaseAdmin
    .from("agents")
    .update({
      wallet_balance: after,
      credit_score: newScore,
      status: agent.status === "frozen" ? "frozen" : "none",
    })
    .eq("id", agent.id);
  if (agentError) throw new Error("Unable to update agent wallet");

  await supabaseAdmin.from("score_history").insert({ agent_id: agent.id, score: newScore });

  return { agentName: agent.name, revenue, repayment, surplus, before, after };
}
