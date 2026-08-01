import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAgents,
  money,
  scoreColor,
  txHash,
  underwrite,
  type Agent,
} from "@/lib/agentline";
import { Panel } from "@/components/ui-kit";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loan Desk — Live Agent Underwriting | AgentLine" },
      {
        name: "description",
        content:
          "Request a task-scoped loan for an AI agent, watch behavioral underwriting run in real time, and disburse into a vendor-whitelisted smart wallet.",
      },
      { property: "og:title", content: "Loan Desk — Live Agent Underwriting" },
      {
        property: "og:description",
        content: "Real-time behavioral underwriting and scoped disbursement for AI agents.",
      },
    ],
  }),
  component: LoanDesk,
});

const TASK_PRESETS = [
  "Enrich 2.5M product records via vendor APIs",
  "Run 30-day signal backtest across 12 venues",
  "Index 250k public listing pages",
  "Localize 400 editorial assets into 6 languages",
  "Optimize 900 freight lanes for next quarter",
];

type Decision = ReturnType<typeof underwrite>;

function LoanDesk() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const list = agents.data ?? [];

  const [agentId, setAgentId] = useState("");
  const [task, setTask] = useState(TASK_PRESETS[0]!);
  const [amount, setAmount] = useState(400000);
  const [revenue, setRevenue] = useState(560000);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10),
  );
  const [scoring, setScoring] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [disbursed, setDisbursed] = useState<{ id: string; hash: string } | null>(null);

  const agent: Agent | undefined = list.find((a) => a.id === agentId);

  const runUnderwriting = () => {
    if (!agent) return;
    setDecision(null);
    setDisbursed(null);
    setScoring(true);
    window.setTimeout(() => {
      setDecision(underwrite(agent, amount, revenue));
      setScoring(false);
    }, 1900);
  };

  const disburse = useMutation({
    mutationFn: async () => {
      if (!agent || !decision) throw new Error("No decision");
      const hash = txHash();
      const { data: loan, error } = await supabase
        .from("loans")
        .insert({
          agent_id: agent.id,
          amount,
          interest_rate: decision.rate,
          task_description: task,
          expected_revenue: revenue,
          expected_repayment_date: dueDate,
          status: "active",
          decision_reasons: decision.topFactors.map(
            (f) => `${f.value >= 0 ? "+" : ""}${f.value} ${f.label.toLowerCase()}`,
          ),
          disbursed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        agent_id: agent.id,
        loan_id: loan.id,
        tx_hash: hash,
        tx_type: "disbursement",
        amount,
        status: "confirmed",
        memo: `Scoped wallet funded — whitelist: ${agent.vendor_whitelist.join(", ")}`,
      });
      if (txError) throw txError;

      const { error: agentError } = await supabase
        .from("agents")
        .update({
          status: "active",
          wallet_balance: Number(agent.wallet_balance) + amount,
          credit_score: decision.projected,
        })
        .eq("id", agent.id);
      if (agentError) throw agentError;

      await supabase
        .from("score_history")
        .insert({ agent_id: agent.id, score: decision.projected });

      return { id: loan.id as string, hash };
    },
    onSuccess: (res) => {
      setDisbursed(res);
      toast.success("Funds disbursed to scoped smart wallet");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Loan Desk</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Task-scoped credit, underwritten on behavioral signal — no collateral, no signed contract.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Loan request">
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Agent
              </span>
              <select
                value={agentId}
                onChange={(e) => {
                  setAgentId(e.target.value);
                  setDecision(null);
                  setDisbursed(null);
                }}
                className="mt-1.5 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Select an agent…</option>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — score {a.credit_score} — limit ₹{money(a.credit_limit)}
                    {a.status === "frozen" ? " (frozen)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Task description
              </span>
              <select
                value={task}
                onChange={(e) => setTask(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {TASK_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Amount needed
                </span>
                <input
                  type="number"
                  value={amount}
                  min={1000}
                  step={1000}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="num mt-1.5 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Expected revenue
                </span>
                <input
                  type="number"
                  value={revenue}
                  min={0}
                  step={1000}
                  onChange={(e) => setRevenue(Number(e.target.value))}
                  className="num mt-1.5 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Expected repayment date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="num mt-1.5 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

            <button
              disabled={!agent || scoring}
              onClick={runUnderwriting}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {scoring ? "Underwriting…" : "Run underwriting"}
            </button>
          </div>
        </Panel>

        <Panel title="Underwriting engine">
          {!agent && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Select an agent to begin.
            </p>
          )}

          {agent && scoring && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <div className="num text-xs tracking-[0.16em] text-muted-foreground uppercase">
                Scoring behavioral signal…
              </div>
              <div className="w-full max-w-xs space-y-1.5">
                {[
                  "Verifying principal signature",
                  "Replaying 90d task ledger",
                  "Computing revenue variance",
                  "Stress-testing spend cap",
                ].map((s, i) => (
                  <div
                    key={s}
                    className="num flex items-center gap-2 text-[11px] text-muted-foreground flow-in"
                    style={{ animationDelay: `${i * 380}ms` }}
                  >
                    <span className="h-1 w-1 rounded-full bg-primary" /> {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {agent && decision && !scoring && (
            <div className="flow-in space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-4">
                <div>
                  <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Projected score
                  </div>
                  <div
                    className={`num text-3xl font-semibold live-glow ${scoreColor(decision.projected)}`}
                  >
                    {decision.projected}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                    decision.approved
                      ? "border-success/50 bg-success/12 text-success"
                      : "border-destructive/50 bg-destructive/12 text-destructive"
                  }`}
                >
                  {decision.approved ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {decision.approved ? "APPROVED" : "DENIED"}
                </div>
              </div>

              <div>
                <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Top decision factors
                </div>
                <div className="mt-2 space-y-1.5">
                  {decision.topFactors.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <span
                        className={`num font-medium ${f.value >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {f.value >= 0 ? "+" : ""}
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="num grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-md border border-border/60 bg-secondary/25 py-2">
                  <div className="text-[10px] text-muted-foreground">RATE</div>
                  <div className="text-primary">{decision.rate.toFixed(2)}%</div>
                </div>
                <div className="rounded-md border border-border/60 bg-secondary/25 py-2">
                  <div className="text-[10px] text-muted-foreground">COVERAGE</div>
                  <div className="text-cyan">{decision.coverage.toFixed(2)}x</div>
                </div>
                <div className="rounded-md border border-border/60 bg-secondary/25 py-2">
                  <div className="text-[10px] text-muted-foreground">DUE AT MATURITY</div>
                  <div className="text-violet">
                    ₹{money(Math.round(amount * (1 + decision.rate / 100)))}
                  </div>
                </div>
              </div>

              {!decision.approved && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  Denied — {agent.status === "frozen"
                    ? "agent access is frozen by the risk console."
                    : decision.coverage < 1.1
                      ? "expected revenue does not cover principal plus interest with margin."
                      : amount > agent.credit_limit
                        ? "request exceeds the agent's underwritten credit limit."
                        : "projected score below the 600 approval floor."}
                </p>
              )}

              {decision.approved && !disbursed && (
                <div className="rounded-lg border border-primary/40 bg-primary/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Lock className="h-4 w-4" /> Scoped smart wallet
                  </div>
                  <p className="num mt-1 text-[11px] break-all text-muted-foreground">
                    {agent.wallet_address}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {agent.vendor_whitelist.map((v) => (
                      <span
                        key={v}
                        className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Spend outside the whitelist is rejected at the wallet policy layer.
                  </p>
                  <button
                    disabled={disburse.isPending}
                    onClick={() => disburse.mutate()}
                    className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {disburse.isPending
                      ? "Disbursing…"
                      : `Disburse ₹${money(amount)} to scoped wallet`}
                  </button>
                </div>
              )}

              {disbursed && (
                <div className="flow-in rounded-lg border border-success/40 bg-success/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> Disbursement confirmed
                  </div>
                  <p className="num mt-1 text-[11px] break-all text-muted-foreground">
                    {disbursed.hash}
                  </p>
                  <Link
                    to="/escrow"
                    className="mt-3 inline-block rounded-md border border-success/50 px-3 py-1.5 text-xs text-success hover:bg-success/10"
                  >
                    Go to escrow → simulate task completion
                  </Link>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
