import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Ban, ShieldOff, Snowflake } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { freezeAgentFn, unfreezeAgentFn } from "@/lib/agentline.functions";
import {
  fetchAgents,
  fetchTransactions,
  money,
  scoreColor,
  shortHash,
  statusTone,
  type Agent,
} from "@/lib/agentline";
import { Panel, StatusPill } from "@/components/ui-kit";


export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk Console & Kill Switch — AgentLine" },
      {
        name: "description",
        content:
          "Real-time spend velocity monitoring for autonomous AI agents, anomaly detection, and an instant kill switch that revokes wallet access and logs the revocation.",
      },
      { property: "og:title", content: "Risk Console & Kill Switch — AgentLine" },
      {
        property: "og:description",
        content: "Monitor agent spend velocity and freeze wallet access instantly.",
      },
    ],
  }),
  component: RiskPage,
});

function VelocityChart({ agent }: { agent: Agent }) {
  const data = agent.spend_velocity.map((v, i) => ({ t: `${(11 - i) * 5}m`, v }));
  const color = agent.anomaly ? "var(--destructive)" : "var(--primary)";
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

function RiskPage() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => fetchTransactions(15) });

  const list = agents.data ?? [];
  const flagged = list.filter((a) => a.anomaly && a.status !== "frozen");

  const freeze = useMutation({
    mutationFn: async (agent: Agent) => {
      const reason =
        agent.anomaly_reason ?? "Manual revocation by risk operator — policy breach suspected";
      const { error } = await supabase
        .from("agents")
        .update({
          status: "frozen",
          wallet_balance: 0,
          frozen_at: new Date().toISOString(),
          freeze_reason: reason,
        })
        .eq("id", agent.id);
      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        agent_id: agent.id,
        tx_hash: txHash(),
        tx_type: "revocation",
        amount: 0,
        status: "flagged",
        memo: `ACCESS REVOKED — ${reason}`,
      });
      if (txError) throw txError;

      await supabase
        .from("loans")
        .update({ status: "frozen" })
        .eq("agent_id", agent.id)
        .in("status", ["active", "repaying"]);

      return agent.name;
    },
    onSuccess: (name) => {
      toast.error(`${name} FROZEN — wallet disabled, revocation logged`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unfreeze = useMutation({
    mutationFn: async (agent: Agent) => {
      const { error } = await supabase
        .from("agents")
        .update({ status: "none", frozen_at: null, freeze_reason: null })
        .eq("id", agent.id);
      if (error) throw error;
      await supabase.from("transactions").insert({
        agent_id: agent.id,
        tx_hash: txHash(),
        tx_type: "reinstatement",
        amount: 0,
        status: "confirmed",
        memo: "Access reinstated after operator review",
      });
      return agent.name;
    },
    onSuccess: (name) => {
      toast.success(`${name} reinstated`);
      qc.invalidateQueries();
    },
  });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Risk Console</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Spend velocity, failure signal and instant revocation across every funded agent.
      </p>

      {flagged.map((a) => (
        <div
          key={a.id}
          className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/60 bg-destructive/12 p-4 live-glow text-destructive"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="text-sm font-semibold tracking-tight">
                ANOMALY — {a.name} exceeded spend policy
              </div>
              <p className="mt-0.5 text-xs text-destructive/85">{a.anomaly_reason}</p>
            </div>
          </div>
          <button
            onClick={() => freeze.mutate(a)}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Ban className="h-4 w-4" /> Freeze Agent Access
          </button>
        </div>
      ))}

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => {
          const tone = statusTone(a.status);
          const frozen = a.status === "frozen";
          return (
            <Panel
              key={a.id}
              className={frozen ? "opacity-70" : a.anomaly ? "border-destructive/50" : ""}
            >
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
                <StatusPill label={tone.label} className={tone.className} />
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
                    Cap
                  </div>
                  <div className="num text-lg text-muted-foreground">₹{money(a.spend_cap)}</div>
                </div>
              </div>

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
                <button
                  onClick={() => freeze.mutate(a)}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-destructive/50 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Freeze Agent Access
                </button>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-4" title="Recent protocol events">
        <div className="space-y-1.5">
          {(txs.data ?? []).map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/40 py-1.5 text-[12px] last:border-0"
            >
              <span className="num text-primary">{shortHash(t.tx_hash)}</span>
              <span className="num text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {t.tx_type.replace("_", " ")}
              </span>
              <span className="text-foreground/90">{t.agents?.name}</span>
              <span className="flex-1 truncate text-muted-foreground">{t.memo}</span>
              <span className="num text-[11px] text-muted-foreground">
                {new Date(t.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
