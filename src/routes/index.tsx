import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Wallet, TrendingUp, Layers, Gauge } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAgents,
  fetchLoans,
  money,
  rateForScore,
  scoreBand,
  scoreColor,
  shortHash,
  statusTone,
  type Agent,
  type Loan,
} from "@/lib/agentline";
import { stageMeta } from "@/lib/risk";
import { Panel, Sparkline, StatusPill } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgentLine — Credit Protocol Control Room for AI Agents" },
      {
        name: "description",
        content:
          "Live underwriting, scoped disbursement and escrow-enforced repayment for autonomous AI agents. Monitor agent credit scores, loans and risk in real time.",
      },
      { property: "og:title", content: "AgentLine — Credit Protocol for AI Agents" },
      {
        property: "og:description",
        content:
          "Agent Passports, behavioral underwriting and automated escrow repayment — the control room for AI credit risk.",
      },
    ],
  }),
  component: Dashboard,
});

function Metric({
  label,
  value,
  prefix,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  prefix?: string;
  icon: typeof Wallet;
  tone: string;
}) {
  return (
    <div className="glass scan-line rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </span>
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
      </div>
      <div className={`num mt-2 text-2xl font-semibold live-glow ${tone}`}>
        {prefix}
        {value}
      </div>
    </div>
  );
}

function AgentCard({ agent, activeRate }: { agent: Agent; activeRate?: number }) {
  const tone = statusTone(agent.status);
  const stage = stageMeta(agent.risk_stage);
  const priced = rateForScore(agent.credit_score);
  return (
    <Link
      to="/agents/$agentId"
      params={{ agentId: agent.id }}
      className="glass glass-hover group block rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{agent.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {agent.principals?.name} · {agent.principals?.jurisdiction}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill label={stage.label} className={stage.className} />
          <StatusPill label={tone.label} className={tone.className} />
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className={`num text-4xl font-semibold live-glow ${scoreColor(agent.credit_score)}`}>
            {agent.credit_score}
          </div>
          <div className="num mt-1 text-[10px] tracking-[0.2em] text-muted-foreground">
            {scoreBand(agent.credit_score)} · /850
          </div>
        </div>
        <div className="h-10 w-28 opacity-80">
          <Sparkline
            values={agent.recent_task_revenue}
            color={agent.anomaly ? "var(--destructive)" : "var(--primary)"}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
        <div>
          <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Credit limit
          </div>
          <div className="num mt-0.5 text-sm">₹{money(agent.credit_limit)}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Wallet
          </div>
          <div className="num mt-0.5 text-sm">₹{money(agent.wallet_balance)}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {activeRate != null ? "Active loan rate" : "Indicative rate"}
          </div>
          <div className={`num mt-0.5 text-sm ${priced.tier.tone}`}>
            {(activeRate ?? priced.rate).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Pricing tier
          </div>
          <div className={`mt-0.5 text-[11px] ${priced.tier.tone}`}>{priced.tier.label}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="num text-[11px] text-muted-foreground">
          {shortHash(agent.wallet_address)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Passport <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>

      {agent.risk_stage !== "healthy" && (
        <p className={`mt-3 rounded-md border px-2.5 py-1.5 text-[11px] ${stage.className}`}>
          {agent.risk_reason ?? stage.blurb}
        </p>
      )}
    </Link>
  );
}

function RateDistribution({ agents, loans }: { agents: Agent[]; loans: Loan[] }) {
  const rows = agents.map((a) => {
    const active = loans.find(
      (l) => l.agent_id === a.id && ["active", "repaying"].includes(l.status),
    );
    const priced = rateForScore(a.credit_score);
    return {
      name: a.name,
      score: a.credit_score,
      tier: priced.tier.label,
      rate: active ? Number(active.interest_rate) : priced.rate,
      live: Boolean(active),
      color:
        a.credit_score >= 750
          ? "var(--success)"
          : a.credit_score >= 650
            ? "var(--cyan)"
            : a.credit_score >= 550
              ? "var(--warning)"
              : "var(--destructive)",
    };
  });

  return (
    <Panel
      className="mt-6"
      title="Cost of capital by credit score"
      subtitle="Better-behaved agents pay less — rate is derived from the score, not negotiated."
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              unit="%"
              domain={[0, 30]}
            />
            <Tooltip
              cursor={{ fill: "var(--secondary)" }}
              contentStyle={{
                background: "oklch(0.19 0.033 266)",
                border: "1px solid oklch(0.32 0.04 266)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(v: number) => [`${Number(v).toFixed(2)}%`, "Interest rate"]}
            />
            <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 text-right font-medium">Score</th>
              <th className="pb-2 font-medium">Tier</th>
              <th className="pb-2 text-right font-medium">Rate</th>
              <th className="pb-2 text-right font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border/50">
                <td className="py-2 font-medium">{r.name}</td>
                <td className={`num py-2 text-right ${scoreColor(r.score)}`}>{r.score}</td>
                <td className="py-2 text-muted-foreground">{r.tier}</td>
                <td className="num py-2 text-right">{r.rate.toFixed(2)}%</td>
                <td className="num py-2 text-right text-[11px] text-muted-foreground">
                  {r.live ? "active loan" : "indicative"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Dashboard() {
  const agents = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const loans = useQuery({ queryKey: ["loans"], queryFn: fetchLoans });

  const list = agents.data ?? [];
  const loanList = loans.data ?? [];
  const deployed = loanList
    .filter((l) => l.disbursed_at)
    .reduce((s, l) => s + Number(l.amount), 0);
  const repaid = loanList
    .filter((l) => l.status === "repaid")
    .reduce((s, l) => s + Number(l.amount) * (1 + Number(l.interest_rate) / 100), 0);
  const activeCount = loanList.filter((l) => ["active", "repaying"].includes(l.status)).length;
  const avgScore = list.length
    ? Math.round(list.reduce((s, a) => s + a.credit_score, 0) / list.length)
    : 0;

  return (
    <div className="relative">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Credit Control Room</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Behavioral underwriting and escrow-enforced repayment across the agent fleet.
            </p>
          </div>
          <Link
            to="/loans"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open loan desk
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Capital deployed"
            value={money(deployed)}
            prefix="₹"
            icon={Wallet}
            tone="text-primary"
          />
          <Metric
            label="Total repaid"
            value={money(Math.round(repaid))}
            prefix="₹"
            icon={TrendingUp}
            tone="text-success"
          />
          <Metric
            label="Active loans"
            value={String(activeCount)}
            icon={Layers}
            tone="text-violet"
          />
          <Metric label="Avg credit score" value={String(avgScore)} icon={Gauge} tone="text-cyan" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {agents.isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass h-56 animate-pulse rounded-xl" />
            ))}
          {list.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              activeRate={
                loanList.find(
                  (l) => l.agent_id === a.id && ["active", "repaying"].includes(l.status),
                )
                  ? Number(
                      loanList.find(
                        (l) => l.agent_id === a.id && ["active", "repaying"].includes(l.status),
                      )!.interest_rate,
                    )
                  : undefined
              }
            />
          ))}
        </div>

        <RateDistribution agents={list} loans={loanList} />

        <Panel className="mt-6" title="Loan book">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Task</th>
                  <th className="pb-2 text-right font-medium">Principal</th>
                  <th className="pb-2 text-right font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Due</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loanList.map((l) => {
                  const t = statusTone(l.status);
                  return (
                    <tr key={l.id} className="border-t border-border/50">
                      <td className="py-2.5 font-medium">{l.agents?.name}</td>
                      <td className="max-w-[320px] truncate py-2.5 text-muted-foreground">
                        {l.task_description}
                      </td>
                      <td className="num py-2.5 text-right">₹{money(Number(l.amount))}</td>
                      <td className="num py-2.5 text-right">{Number(l.interest_rate).toFixed(2)}%</td>
                      <td className="num py-2.5 text-right text-muted-foreground">
                        {l.expected_repayment_date ?? "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <StatusPill label={t.label} className={t.className} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
