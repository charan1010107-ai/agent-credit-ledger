// Server-only: creates the account's single agent with the privileged client after
// re-deriving every financial value from the user's inputs. Never trusts the browser.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { txHash } from "./underwriting";
import { deriveStartingProfile } from "./onboarding";
import type { CreateAgentInput } from "./account.schemas";

function walletAddress(): string {
  return txHash();
}

export async function createOwnedAgent(userId: string, input: CreateAgentInput) {
  const { data: existing } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (existing) throw new Error("This account already owns an agent");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, account_type, display_name, org_name, principal_id")
    .eq("id", userId)
    .maybeSingle();

  const accountType = (profile?.account_type as string) ?? "individual";
  const principalName =
    (accountType === "organization" ? profile?.org_name : profile?.display_name) ||
    profile?.display_name ||
    "Unnamed principal";

  let principalId = profile?.principal_id as string | null | undefined;
  if (!principalId) {
    const { data: principal, error: pErr } = await supabaseAdmin
      .from("principals")
      .insert({
        name: principalName,
        entity_type: accountType === "organization" ? "org" : "individual",
        jurisdiction: "IN-KA",
        reputation_score: accountType === "organization" ? 720 : 690,
        signature_hash: txHash(),
      })
      .select("id")
      .single();
    if (pErr || !principal) throw new Error("Unable to register principal");
    principalId = principal.id as string;
    await supabaseAdmin.from("profiles").update({ principal_id: principalId }).eq("id", userId);
  }

  const p = deriveStartingProfile(input);
  const starterTask = input.starterTask?.trim() || p.useCase.starterTask;
  const vendors =
    input.vendorWhitelist && input.vendorWhitelist.length > 0
      ? input.vendorWhitelist
      : p.useCase.vendors;
  const stats = input.derivedStats;

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .insert({
      owner_id: userId,
      name: input.agentName,
      principal_id: principalId,
      wallet_address: walletAddress(),
      credit_score: p.score,
      credit_limit: p.creditLimit,
      baseline_credit_limit: p.creditLimit,
      status: "none",
      task_scope: starterTask,
      spend_cap: p.spendCap,
      wallet_balance: 0,
      task_success_rate: stats ? Math.round(stats.successRate) : p.successRate,
      avg_completion_minutes: p.completionMinutes,
      spend_consistency: stats ? Math.round(stats.revenueConsistency) : p.spendConsistency,
      anomaly: false,
      vendor_whitelist: vendors,
      score_factors: p.factors,
      recent_task_revenue: [],
      spend_velocity: [],
      risk_stage: "healthy",
      risk_signals: 0,
    })
    .select("id")
    .single();
  if (error || !agent) throw new Error(error?.message ?? "Unable to create agent");

  await supabaseAdmin.from("score_history").insert({ agent_id: agent.id, score: p.score });

  await supabaseAdmin.from("transactions").insert({
    agent_id: agent.id as string,
    tx_hash: txHash(),
    tx_type: "passport_issued",
    amount: 0,
    status: "confirmed",
    memo:
      `Agent Passport issued to ${principalName} — starter task: ${starterTask}` +
      (stats
        ? ` · derived from ${stats.rows} uploaded task rows (${stats.successRate}% success, ${stats.failures} failures)`
        : ""),
  });


  return { agentId: agent.id as string, score: p.score };
}
