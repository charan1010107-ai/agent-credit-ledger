import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  fetchAgent,
  fetchLoans,
  fetchScoreHistory,
  money,
  rateForScore,
  scoreBand,
  scoreColor,
  statusTone,
} from "@/lib/agentline";
import { stageMeta } from "@/lib/risk";
import { Field, Panel, StatusPill } from "@/components/ui-kit";

export const Route = createFileRoute("/agents/$agentId")({
  head: () => ({
    meta: [
      { title: "Agent Passport — AgentLine" },
      {
        name: "description",
        content:
          "Agent Passport: identity, linked principal, behavioral history and SHAP-style credit score breakdown for an autonomous AI agent.",
      },
      { property: "og:title", content: "Agent Passport — AgentLine" },
      {
        property: "og:description",
        content: "Identity, behavioral history and credit score attribution for an AI agent.",
      },
    ],
  }),
  component: PassportPage,
});

const tooltipStyle = {
  background: "oklch(0.19 0.033 266)",
  border: "1px solid oklch(0.32 0.04 266)",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
};

function PassportPage() {
  const { agentId } = Route.useParams();
  const agent = useQuery({ queryKey: ["agent", agentId], queryFn: () => fetchAgent(agentId) });
  const history = useQuery({
    queryKey: ["score-history", agentId],
    queryFn: () => fetchScoreHistory(agentId),
  });
  const loans = useQuery({ queryKey: ["loans"], queryFn: fetchLoans });

  const a = agent.data;
  if (!a) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-sm text-muted-foreground">
        Loading passport…
      </div>
    );
  }

  const tone = statusTone(a.status);
  const factors = [...a.score_factors].sort((x, y) => y.value - x.value);
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.value)), 1);
  const revenue = a.recent_task_revenue.map((v, i) => ({ task: `T${i + 1}`, revenue: v }));
  const scores = (history.data ?? []).map((p) => ({
    t: new Date(p.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: p.score,
  }));
  const agentLoans = (loans.data ?? []).filter((l) => l.agent_id === agentId);
  const activeLoan = agentLoans.find((l) => ["active", "repaying"].includes(l.status));
  const priced = rateForScore(a.credit_score);
  const stage = stageMeta(a.risk_stage);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Control room
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{a.task_scope}</p>
        </div>
        <div className="flex items-center gap-4">
          <StatusPill label={stage.label} className={stage.className} />
          <StatusPill label={tone.label} className={tone.className} />
          <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-right">
            <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {activeLoan ? "Active loan rate" : "Indicative rate"}
            </div>
            <div className={`num text-2xl font-semibold ${priced.tier.tone}`}>
              {(activeLoan ? Number(activeLoan.interest_rate) : priced.rate).toFixed(2)}%
            </div>
            <div className="text-[10px] text-muted-foreground">{priced.tier.label}</div>
          </div>
          <div className="text-right">
            <div className={`num text-4xl font-semibold live-glow ${scoreColor(a.credit_score)}`}>
              {a.credit_score}
            </div>
            <div className="num text-[10px] tracking-[0.2em] text-muted-foreground">
              {scoreBand(a.credit_score)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Agent passport" className="lg:col-span-1">
          <dl>
            <Field label="Agent ID" value={a.id} mono />
            <Field label="Scoped wallet" value={a.wallet_address} mono />
            <Field
              label="Linked principal"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-success" />
                  {a.principals?.name} ({a.principals?.entity_type})
                </span>
              }
            />
            <Field label="Principal signature" value={a.principals?.signature_hash ?? "—"} mono />
            <Field
              label="Signed at"
              value={
                a.principals?.signed_at ? new Date(a.principals.signed_at).toUTCString() : "—"
              }
              mono
            />
            <Field label="Jurisdiction" value={a.principals?.jurisdiction ?? "—"} />
            <Field label="Declared task scope" value={a.task_scope} />
            <Field label="Spend cap / cycle" value={`₹${money(a.spend_cap)}`} mono />
            <Field label="Credit limit" value={`₹${money(a.credit_limit)}`} mono />
            <Field
              label="Risk stage"
              value={
                <span className="flex flex-col gap-1">
                  <StatusPill label={stage.label} className={stage.className} />
                  <span className="text-[11px] text-muted-foreground">
                    {a.risk_reason ?? stage.blurb}
                  </span>
                </span>
              }
            />
            <Field
              label="Vendor whitelist"
              value={
                <span className="flex flex-wrap gap-1.5">
                  {a.vendor_whitelist.map((v) => (
                    <span
                      key={v}
                      className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
                    >
                      {v}
                    </span>
                  ))}
                </span>
              }
            />
          </dl>
        </Panel>

        <div className="grid gap-4 lg:col-span-2">
          <Panel title="Behavioral history">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { l: "Task success", v: `${a.task_success_rate}%`, c: "text-success" },
                { l: "Avg completion", v: `${a.avg_completion_minutes}m`, c: "text-cyan" },
                { l: "Spend consistency", v: `${a.spend_consistency}`, c: "text-violet" },
                { l: "Wallet balance", v: `₹${money(a.wallet_balance)}`, c: "text-primary" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    {s.l}
                  </div>
                  <div className={`num mt-1 text-lg font-semibold ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 h-52">
              <div className="mb-2 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Revenue per task — last 10
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={revenue}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="task" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)" }} />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Credit score trend — 12 weeks">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scores}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={["dataMin - 30", "dataMax + 30"]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--violet)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Score attribution"
          subtitle="Factor contributions to the current Agent Credit Score"
        >
          <div className="space-y-2.5">
            {factors.map((f) => {
              const pct = (Math.abs(f.value) / maxAbs) * 50;
              const pos = f.value >= 0;
              return (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-right text-xs text-muted-foreground">
                    {f.label}
                  </span>
                  <div className="relative h-5 flex-1">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded-sm ${pos ? "bg-success/70" : "bg-destructive/70"}`}
                      style={
                        pos
                          ? { left: "50%", width: `${pct}%` }
                          : { right: "50%", width: `${pct}%` }
                      }
                    />
                  </div>
                  <span
                    className={`num w-12 text-xs ${pos ? "text-success" : "text-destructive"}`}
                  >
                    {pos ? "+" : ""}
                    {f.value}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Attribution is computed per-decision and stored with the loan record, so every approval
            or denial is explainable after the fact.
          </p>
        </Panel>

        <Panel title="Loan history">
          <div className="space-y-2">
            {agentLoans.length === 0 && (
              <p className="text-sm text-muted-foreground">No loans on record.</p>
            )}
            {agentLoans.map((l) => {
              const t = statusTone(l.status);
              return (
                <div
                  key={l.id}
                  className="rounded-lg border border-border/60 bg-secondary/25 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{l.task_description}</div>
                      <div className="num mt-1 text-[11px] text-muted-foreground">
                        ₹{money(Number(l.amount))} @ {Number(l.interest_rate).toFixed(2)}% · exp. rev
                        ₹{money(Number(l.expected_revenue))}
                      </div>
                    </div>
                    <StatusPill label={t.label} className={t.className} />
                  </div>
                  {l.decision_reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {l.decision_reasons.map((r) => (
                        <span
                          key={r}
                          className="num rounded border border-border bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
