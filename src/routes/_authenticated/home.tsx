import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyAgent, fetchMyProfile, principalLabel, useSession } from "@/lib/account";
import {
  USE_CASES,
  deriveStartingProfile,
  starterPlanFromAgent,
  type Frequency,
  type UseCaseKey,
} from "@/lib/onboarding";
import { createAgentFn } from "@/lib/account.functions";
import {
  disburseLoanFn,
  settleLoanFn,
  escalateRiskFn,
  deescalateRiskFn,
} from "@/lib/agentline.functions";
import { fetchLoans, money, scoreBand, scoreColor, rateForScore } from "@/lib/agentline";
import { stageMeta, stageActionLabel } from "@/lib/risk";
import { Field, Panel, StatusPill } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "My Agent — AgentLine" },
      {
        name: "description",
        content:
          "Your personal AgentLine agent: passport, credit score, limit, interest rate, starter task and escrow-backed repayment.",
      },
      { property: "og:title", content: "My Agent — AgentLine" },
      { property: "og:description", content: "Your agent's passport, credit line and escrow." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, ready } = useSession();
  const userId = user?.id;

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchMyProfile(userId!),
    enabled: !!userId,
  });
  const agentQ = useQuery({
    queryKey: ["my-agent", userId],
    queryFn: () => fetchMyAgent(userId!),
    enabled: !!userId,
  });

  if (!ready || agentQ.isLoading) {
    return (
      <main className="mx-auto max-w-[1100px] px-4 py-16 text-sm text-muted-foreground sm:px-6">
        Loading your account…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      {agentQ.data ? (
        <MyAgent agent={agentQ.data} principal={principalLabel(profileQ.data ?? null)} />
      ) : (
        <CreateAgent />
      )}
    </main>
  );
}

/* ------------------------------- creation ------------------------------- */

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

function CreateAgent() {
  const qc = useQueryClient();
  const [step, setStep] = useState<"form" | "summary">("form");
  const [agentName, setAgentName] = useState("");
  const [useCase, setUseCase] = useState<UseCaseKey>("data_scraping");
  const [frequency, setFrequency] = useState<Frequency>("medium");
  const [riskTolerance, setRiskTolerance] = useState(3);
  const [spendIntensity, setSpendIntensity] = useState(3);

  const input = { agentName: agentName.trim() || "Unnamed", useCase, frequency, riskTolerance, spendIntensity };
  const preview = deriveStartingProfile(input);

  const create = useMutation({
    mutationFn: () => createAgentFn({ data: { ...input, agentName: agentName.trim() } }),
    onSuccess: async () => {
      toast.success("Agent Passport issued");
      await qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (step === "summary") {
    return (
      <div className="space-y-5">
        <div>
          <p className="num text-[10px] tracking-[0.18em] text-primary uppercase">
            Step 2 · Confirmation
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Here's your agent</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Derived deterministically from your use case and behavioural settings — nothing random.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Panel title="Provisional passport" subtitle={agentName.trim() || "Unnamed agent"}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Starting score
                </p>
                <p className={cn("num mt-1 text-4xl font-semibold", scoreColor(preview.score))}>
                  {preview.score}
                </p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {scoreBand(preview.score)}
                </p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Interest rate
                </p>
                <p className={cn("num mt-1 text-4xl font-semibold", preview.tier.tone)}>
                  {preview.rate.toFixed(2)}%
                </p>
                <p className="num mt-1 text-[11px] text-muted-foreground">{preview.tier.label}</p>
              </div>
            </div>
            <dl className="mt-4">
              <Field label="Credit limit" value={`₹${money(preview.creditLimit)}`} mono />
              <Field label="Scoped spend cap" value={`₹${money(preview.spendCap)}`} mono />
              <Field label="Starter task" value={preview.useCase.starterTask} />
              <Field
                label="Suggested first loan"
                value={`₹${money(preview.suggestedLoan)}`}
                mono
              />
              <Field
                label="Estimated return on task"
                value={`₹${money(preview.estimatedReturn)}`}
                mono
              />
            </dl>
          </Panel>

          <Panel title="Score attribution" subtitle="How the starting score was assembled">
            <p className="num text-[11px] text-muted-foreground">Neutral anchor 620</p>
            <ul className="mt-3 space-y-2">
              {preview.factors.map((f) => (
                <li key={f.label} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span
                    className={cn(
                      "num font-medium",
                      f.value >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {f.value >= 0 ? "+" : ""}
                    {f.value}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BadgeCheck className="h-3.5 w-3.5" />
            )}
            Issue passport
          </button>
          <button
            onClick={() => setStep("form")}
            className="rounded-md border border-border bg-secondary/40 px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="num text-[10px] tracking-[0.18em] text-primary uppercase">
          Step 1 · Configuration
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your agent</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Each account operates exactly one agent. Its opening credit line is derived from the
          use case and the behavioural assumptions you set below.
        </p>
      </div>

      <Panel title="Identity">
        <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Agent name
        </span>
        <input
          value={agentName}
          maxLength={40}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="Atlas-1"
          className="mt-1.5 w-full max-w-sm rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
      </Panel>

      <Panel title="Sample use case" subtitle="What this agent will do">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => (
            <button
              key={uc.key}
              onClick={() => setUseCase(uc.key)}
              className={cn(
                "rounded-lg border p-3.5 text-left transition-colors",
                useCase === uc.key
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-secondary/25 hover:bg-secondary/50",
              )}
            >
              <p className="text-[13px] font-medium">{uc.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{uc.blurb}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Starting behavioural assumptions">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Expected task frequency
            </p>
            <div className="mt-2 flex gap-1.5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFrequency(f.key)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                    frequency === f.key
                      ? "border-primary/60 bg-primary/12 text-foreground"
                      : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Risk tolerance"
            value={riskTolerance}
            onChange={setRiskTolerance}
            left="Conservative"
            right="Aggressive"
          />
          <Slider
            label="Spend intensity"
            value={spendIntensity}
            onChange={setSpendIntensity}
            left="Frugal"
            right="Heavy"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border/60 pt-4">
          <span className="num text-[11px] text-muted-foreground">
            Live preview · score{" "}
            <span className={scoreColor(preview.score)}>{preview.score}</span> · limit ₹
            {money(preview.creditLimit)} · rate {preview.rate.toFixed(2)}%
          </span>
          <button
            onClick={() => setStep("summary")}
            disabled={agentName.trim().length < 2}
            className="ml-auto flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Review agent <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Panel>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  left,
  right,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  left: string;
  right: string;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--primary)]"
      />
      <div className="num mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{left}</span>
        <span className="text-foreground">{value}/5</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

/* ------------------------------- my agent ------------------------------- */

type AgentT = NonNullable<Awaited<ReturnType<typeof fetchMyAgent>>>;

function MyAgent({ agent, principal }: { agent: AgentT; principal: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const plan = starterPlanFromAgent(agent);
  const stage = stageMeta(agent.risk_stage);
  const { tier, rate } = rateForScore(agent.credit_score);

  const loansQ = useQuery({ queryKey: ["loans"], queryFn: fetchLoans });
  const myLoans = (loansQ.data ?? []).filter((l) => l.agent_id === agent.id);
  const openLoan = myLoans.find((l) => ["active", "repaying"].includes(l.status));

  const [split, setSplit] = useState<Awaited<ReturnType<typeof settleLoanFn>> | null>(null);

  const refresh = async () => {
    await qc.invalidateQueries();
  };

  const borrow = useMutation({
    mutationFn: () =>
      disburseLoanFn({
        data: {
          agentId: agent.id,
          amount: plan.suggestedLoan,
          expectedRevenue: plan.estimatedReturn,
          taskDescription: plan.starterTask,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        },
      }),
    onSuccess: async () => {
      toast.success("Capital disbursed to scoped wallet");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: () => settleLoanFn({ data: { loanId: openLoan!.id } }),
    onSuccess: async (res) => {
      setSplit(res);
      toast.success("Escrow settled");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const escalate = useMutation({
    mutationFn: () => escalateRiskFn({ data: { agentId: agent.id } }),
    onSuccess: async () => {
      toast.warning("Risk stage escalated");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => deescalateRiskFn({ data: { agentId: agent.id } }),
    onSuccess: async () => {
      toast.success("Risk stage stepped down");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="num text-[10px] tracking-[0.18em] text-primary uppercase">My agent</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Principal · {principal} · wallet{" "}
            <span className="num">{agent.wallet_address.slice(0, 14)}…</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={stage.label} className={stage.className} />
          <Link
            to="/agents/$agentId"
            params={{ agentId: agent.id }}
            className="rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-[13px] transition-colors hover:bg-secondary"
          >
            Full passport
          </Link>
          <button
            onClick={signOut}
            className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>

      {agent.risk_stage !== "healthy" && (
        <div
          className={cn(
            "glass rounded-xl border p-4 text-[13px]",
            stage.panelClassName || "border-border",
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" /> {stage.label} — {stage.blurb}
          </p>
          {agent.risk_reason && (
            <p className="mt-1 text-muted-foreground">{agent.risk_reason}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel>
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Credit score
          </p>
          <p className={cn("num mt-2 text-3xl font-semibold", scoreColor(agent.credit_score))}>
            {agent.credit_score}
          </p>
          <p className="num mt-1 text-[11px] text-muted-foreground">
            {scoreBand(agent.credit_score)}
          </p>
        </Panel>
        <Panel>
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Credit limit
          </p>
          <p className="num mt-2 text-3xl font-semibold">₹{money(agent.credit_limit)}</p>
          {agent.baseline_credit_limit != null &&
            Number(agent.baseline_credit_limit) !== Number(agent.credit_limit) && (
              <p className="num mt-1 text-[11px] text-orange">
                throttled from ₹{money(Number(agent.baseline_credit_limit))}
              </p>
            )}
        </Panel>
        <Panel>
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Cost of capital
          </p>
          <p className={cn("num mt-2 text-3xl font-semibold", tier.tone)}>
            {(openLoan ? Number(openLoan.interest_rate) : rate).toFixed(2)}%
          </p>
          <p className="num mt-1 text-[11px] text-muted-foreground">{tier.label}</p>
        </Panel>
        <Panel>
          <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Wallet balance
          </p>
          <p className="num mt-2 text-3xl font-semibold text-cyan">
            ₹{money(agent.wallet_balance)}
          </p>
          <p className="num mt-1 text-[11px] text-muted-foreground">
            cap ₹{money(agent.spend_cap)}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel title="Starter task" subtitle={plan.starterTask}>
          <dl>
            <Field label="Use case" value={plan.useCase.label} />
            <Field label="Working capital required" value={`₹${money(plan.suggestedLoan)}`} mono />
            <Field label="Estimated return" value={`₹${money(plan.estimatedReturn)}`} mono />
            <Field
              label="Vendor whitelist"
              value={(agent.vendor_whitelist ?? []).join(", ")}
              mono
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {!openLoan ? (
              <button
                onClick={() => borrow.mutate()}
                disabled={borrow.isPending || agent.status === "frozen"}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {borrow.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wallet className="h-3.5 w-3.5" />
                )}
                Request ₹{money(plan.suggestedLoan)} for this task
              </button>
            ) : (
              <button
                onClick={() => settle.mutate()}
                disabled={settle.isPending}
                className="flex items-center gap-2 rounded-md bg-violet px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {settle.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Simulate task completion
              </button>
            )}
            <Link
              to="/loans"
              className="rounded-md border border-border bg-secondary/40 px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              Custom loan
            </Link>
          </div>
        </Panel>

        <Panel title="Escrow split" subtitle="Revenue routes to the lender first">
          {split ? (
            <dl>
              <Field label="Task revenue" value={`₹${money(split.revenue)}`} mono />
              <Field label="Principal repaid" value={`₹${money(split.principal)}`} mono />
              <Field
                label={`Interest @ ${split.rate.toFixed(2)}%`}
                value={`₹${money(split.interest)}`}
                mono
              />
              <Field label="Surplus to agent" value={`₹${money(split.surplus)}`} mono />
              <Field
                label="Wallet"
                value={`₹${money(split.before)} → ₹${money(split.after)}`}
                mono
              />
            </dl>
          ) : openLoan ? (
            <p className="text-[13px] text-muted-foreground">
              Loan of ₹{money(Number(openLoan.amount))} is live at{" "}
              {Number(openLoan.interest_rate).toFixed(2)}%. Complete the task to see the split.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No open loan. Draw capital for the starter task to run an escrow settlement.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <button
              onClick={() => escalate.mutate()}
              disabled={escalate.isPending || agent.risk_stage === "frozen"}
              className="rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-[12px] text-warning transition-colors hover:bg-warning/20 disabled:opacity-50"
            >
              {stageActionLabel(agent.risk_stage)}
            </button>
            <button
              onClick={() => clear.mutate()}
              disabled={clear.isPending || agent.risk_stage === "healthy"}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Step down
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="My loan history">
        {myLoans.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No loans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="num text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                <tr>
                  <th className="py-2">Task</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {myLoans.map((l) => (
                  <tr key={l.id} className="border-t border-border/50">
                    <td className="py-2 pr-4">{l.task_description}</td>
                    <td className="num py-2 pr-4">₹{money(Number(l.amount))}</td>
                    <td className="num py-2 pr-4">{Number(l.interest_rate).toFixed(2)}%</td>
                    <td className="num py-2 uppercase">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
