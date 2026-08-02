import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Ban, ChevronUp, ShieldOff, Snowflake, Undo2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  deescalateRiskFn,
  escalateRiskFn,
  freezeAgentFn,
  unfreezeAgentFn,
} from "@/lib/agentline.functions";
import {
  fetchAgents,
  fetchTransactions,
  money,
  scoreColor,
  shortHash,
  type Agent,
} from "@/lib/agentline";
import { stageActionLabel, stageMeta } from "@/lib/risk";
import { Panel, StatusPill } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/risk")({
  head: () => ({
    meta: [
      { title: "Risk Console & Graduated Response — AgentLine" },
      {
        name: "description",
        content:
          "Spend velocity monitoring for autonomous AI agents with a three-stage graduated risk response: Warning, Throttled and Frozen, each logged to the protocol event ledger.",
      },
      { property: "og:title", content: "Risk Console & Graduated Response — AgentLine" },
      {
        property: "og:description",
        content: "Warning → Throttled → Frozen escalation with an instant kill switch.",
      },
    ],
  }),
  component: RiskPage,
});

function VelocityChart({ agent }: { agent: Agent }) {
  const data = agent.spend_velocity.map((v, i) => ({ t: `${(11 - i) * 5}m`, v }));
  const stage = agent.risk_stage ?? "healthy";
  const color =
    stage === "frozen"
      ? "var(--destructive)"
      : stage === "throttled"
        ? "var(--orange)"
        : stage === "warning"
          ? "var(--warning)"
          : "var(--primary)";
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`g-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "oklch(0.19 0.033 266)",
            border: "1px solid oklch(0.32 0.04 266)",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#g-${agent.id})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const STAGES = ["healthy", "warning", "throttled", "frozen"] as const;

function StageRail({ stage }: { stage: string }) {
  const idx = Math.max(0, STAGES.indexOf(stage as (typeof STAGES)[number]));
  return (
    <div className="mt-3 flex items-center gap-1">
      {STAGES.map((s, i) => {
        const meta = stageMeta(s);
        const on = i <= idx;
        return (
          <div key={s} className="flex-1">
            <div
              className={`h-1 rounded-full ${
                on
                  ? s === "frozen"
                    ? "bg-destructive"
                    : s === "throttled"
                      ? "bg-orange"
                      : s === "warning"
                        ? "bg-warning"
                        : "bg-success"
                  : "bg-border"
              }`}
            />
            <div
              className={`mt-1 text-[9px] tracking-[0.12em] uppercase ${
                i === idx ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {meta.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskPage() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => fetchTransactions(20) });

  const list = agents.data ?? [];
  const flagged = list.filter(
    (a) => a.risk_stage === "warning" || a.risk_stage === "throttled",
  );

  const escalate = useMutation({
    mutationFn: async (agent: Agent) => escalateRiskFn({ data: { agentId: agent.id } }),
    onSuccess: (res) => {
      const meta = stageMeta(res.to);
      if (res.to === "frozen") toast.error(`${res.name} FROZEN — wallet disabled, revocation logged`);
      else toast.warning(`${res.name} → ${meta.label.toUpperCase()} — ${res.reason}`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deescalate = useMutation({
    mutationFn: async (agent: Agent) => deescalateRiskFn({ data: { agentId: agent.id } }),
    onSuccess: (res) => {
      toast.success(`${res.name} risk stage stepped down`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const freeze = useMutation({
    mutationFn: async (agent: Agent) => {
      // Kill switch executes server-side; the browser cannot write agent state directly.
      const res = await freezeAgentFn({ data: { agentId: agent.id } });
      return res.name;
    },
    onSuccess: (name) => {
      toast.error(`${name} FROZEN — wallet disabled, revocation logged`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unfreeze = useMutation({
    mutationFn: async (agent: Agent) => {
      const res = await unfreezeAgentFn({ data: { agentId: agent.id } });
      return res.name;
    },
    onSuccess: (name) => {
      toast.success(`${name} reinstated`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Risk Console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Graduated response — Warning, Throttled, Frozen — with instant manual revocation at any
        stage.
      </p>

      {flagged.map((a) => {
        const meta = stageMeta(a.risk_stage);
        const warn = a.risk_stage === "warning";
        return (
          <div
            key={a.id}
            className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 live-glow ${
              warn
                ? "border-warning/60 bg-warning/12 text-warning"
                : "border-orange/60 bg-orange/12 text-orange"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  {meta.label.toUpperCase()} — {a.name}
                  {!warn && ` · limit cut to ₹${money(a.credit_limit)}`}
                </div>
                <p className="mt-0.5 text-xs opacity-85">{a.risk_reason}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => escalate.mutate(a)}
                className="inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 text-xs font-semibold transition-colors hover:bg-current/10"
              >
                <ChevronUp className="h-3.5 w-3.5" /> {stageActionLabel(a.risk_stage)}
              </button>
              <button
                onClick={() => freeze.mutate(a)}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Ban className="h-4 w-4" /> Freeze Agent Access
              </button>
            </div>
          </div>
        );
      })}

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => {
          const meta = stageMeta(a.risk_stage);
          const frozen = a.risk_stage === "frozen";
          return (
            <Panel key={a.id} className={frozen ? `opacity-70 ${meta.panelClassName}` : meta.panelClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to="/agents/$agentId"
                    params={{ agentId: a.id }}
                    className="text-base font-semibold hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <div className="num mt-0.5 text-[11px] text-muted-foreground">
                    {shortHash(a.wallet_address)}
                  </div>
                </div>
                <StatusPill label={meta.label} className={meta.className} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Score
                  </div>
                  <div className={`num text-lg ${scoreColor(a.credit_score)}`}>
                    {a.credit_score}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Wallet
                  </div>
                  <div className="num text-lg">₹{money(a.wallet_balance)}</div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Limit
                  </div>
                  <div
                    className={`num text-lg ${a.risk_stage === "throttled" ? "text-orange" : "text-muted-foreground"}`}
                  >
                    ₹{money(a.credit_limit)}
                  </div>
                </div>
              </div>

              <StageRail stage={a.risk_stage} />

              {a.risk_reason && !frozen && (
                <p
                  className={`mt-3 rounded-md border px-2.5 py-1.5 text-[11px] ${
                    a.risk_stage === "throttled"
                      ? "border-orange/40 bg-orange/10 text-orange"
                      : "border-warning/40 bg-warning/10 text-warning"
                  }`}
                >
                  {a.risk_reason}
                </p>
              )}

              <div className="mt-3">
                <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Spend velocity — last 60m
                </div>
                <VelocityChart agent={a} />
              </div>

              {frozen ? (
                <div className="mt-2 space-y-2">
                  <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] text-destructive">
                    <Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Wallet disabled {a.frozen_at ? new Date(a.frozen_at).toLocaleString() : ""} —{" "}
                      {a.freeze_reason}
                    </span>
                  </p>
                  <button
                    onClick={() => unfreeze.mutate(a)}
                    className="w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reinstate access
                  </button>
                </div>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => escalate.mutate(a)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-warning/50 px-3 py-2 text-xs font-semibold text-warning transition-colors hover:bg-warning/10"
                  >
                    <ChevronUp className="h-3.5 w-3.5" /> {stageActionLabel(a.risk_stage)}
                  </button>
                  <button
                    onClick={() => freeze.mutate(a)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Freeze
                  </button>
                  {a.risk_stage !== "healthy" && (
                    <button
                      onClick={() => deescalate.mutate(a)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground sm:col-span-2"
                    >
                      <Undo2 className="h-3 w-3" /> Step down after review
                    </button>
                  )}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-4" title="Protocol events — escalation log">
        <div className="space-y-1.5">
          {(txs.data ?? []).map((t) => {
            const tone =
              t.tx_type === "risk_warning"
                ? "text-warning"
                : t.tx_type === "risk_throttle"
                  ? "text-orange"
                  : t.tx_type === "revocation"
                    ? "text-destructive"
                    : "text-muted-foreground";
            return (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 border-b border-border/40 py-1.5 text-[12px] last:border-0"
              >
                <span className="num text-primary">{shortHash(t.tx_hash)}</span>
                <span className={`num text-[10px] tracking-[0.14em] uppercase ${tone}`}>
                  {t.tx_type.replace(/_/g, " ")}
                </span>
                <span className="text-foreground/90">{t.agents?.name}</span>
                <span className="flex-1 truncate text-muted-foreground">{t.memo}</span>
                <span className="num text-[11px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
