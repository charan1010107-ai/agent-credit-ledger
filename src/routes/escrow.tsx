import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, PlayCircle, Split } from "lucide-react";
import { settleLoanFn } from "@/lib/agentline.functions";
import {
  fetchAgents,
  fetchLoans,
  fetchTransactions,
  money,
  shortHash,
  statusTone,
} from "@/lib/agentline";
import { Panel, StatusPill } from "@/components/ui-kit";


export const Route = createFileRoute("/escrow")({
  head: () => ({
    meta: [
      { title: "Escrow & Repayment — AgentLine" },
      {
        name: "description",
        content:
          "Simulate task completion and watch revenue route automatically through escrow: principal plus interest to the lender, surplus released to the agent wallet.",
      },
      { property: "og:title", content: "Escrow & Automated Repayment — AgentLine" },
      {
        property: "og:description",
        content: "Task revenue split automatically between lender escrow and the agent wallet.",
      },
    ],
  }),
  component: EscrowPage,
});

type Settlement = {
  agentName: string;
  rate: number;
  principal: number;
  interest: number;
  revenue: number;
  repayment: number;
  surplus: number;
  before: number;
  after: number;
};

function EscrowPage() {
  const qc = useQueryClient();
  const loans = useQuery({ queryKey: ["loans"], queryFn: fetchLoans });
  const agents = useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => fetchTransactions(40) });

  const [selected, setSelected] = useState("");
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  const openLoans = (loans.data ?? []).filter((l) => ["active", "repaying"].includes(l.status));
  const loan = openLoans.find((l) => l.id === selected);
  const agent = (agents.data ?? []).find((a) => a.id === loan?.agent_id);

  const complete = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("Select a funded loan");
      // Escrow split is computed and written server-side from the stored loan terms.
      const res = await settleLoanFn({ data: { loanId: loan.id } });
      return res satisfies Settlement;
    },
    onSuccess: (s) => {
      setSettlement(s);
      setSelected("");
      toast.success(`${s.agentName} settled — ₹${money(s.repayment)} routed to escrow`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Escrow & Repayment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Task revenue is captured at source and split before it ever reaches the agent wallet.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Funded tasks" className="lg:col-span-1">
          <div className="space-y-2">
            {openLoans.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No open loans. Approve one on the loan desk.
              </p>
            )}
            {openLoans.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected === l.id
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/60 bg-secondary/25 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{l.agents?.name}</span>
                  <StatusPill {...statusTone(l.status)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{l.task_description}</p>
                <p className="num mt-1.5 text-[11px] text-muted-foreground">
                  ₹{money(Number(l.amount))} @ {Number(l.interest_rate).toFixed(2)}% → exp. ₹
                  {money(Number(l.expected_revenue))}
                </p>
              </button>
            ))}
          </div>

          <button
            disabled={!loan || complete.isPending}
            onClick={() => complete.mutate()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <PlayCircle className="h-4 w-4" />
            {complete.isPending ? "Settling…" : "Simulate Task Completion"}
          </button>
        </Panel>

        <Panel title="Settlement flow" className="lg:col-span-2">
          {!settlement && (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Select a funded task and simulate completion to watch the escrow split.
            </p>
          )}
          {settlement && (
            <div className="space-y-4">
              <div className="flow-in rounded-lg border border-cyan/40 bg-cyan/8 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-cyan">
                    <ArrowDownRight className="h-4 w-4" /> Task revenue captured
                  </span>
                  <span className="num text-xl font-semibold text-cyan live-glow">
                    +₹{money(settlement.revenue)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                <Split className="h-3.5 w-3.5" /> Automatic split
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className="flow-in rounded-lg border border-violet/40 bg-violet/8 p-4"
                  style={{ animationDelay: "220ms" }}
                >
                  <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    To lender escrow
                  </div>
                  <div className="num mt-1 text-2xl font-semibold text-violet">
                    ₹{money(settlement.repayment)}
                  </div>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    ₹{money(settlement.principal)} principal + ₹{money(settlement.interest)}{" "}
                    interest @ {settlement.rate.toFixed(2)}% (this agent's score-derived rate)
                  </p>
                </div>
                <div
                  className="flow-in rounded-lg border border-success/40 bg-success/8 p-4"
                  style={{ animationDelay: "420ms" }}
                >
                  <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Surplus to agent wallet
                  </div>
                  <div className="num mt-1 text-2xl font-semibold text-success">
                    ₹{money(settlement.surplus)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Released on settlement</p>
                </div>
              </div>

              <div
                className="flow-in grid grid-cols-3 items-center gap-3 rounded-lg border border-border/60 bg-secondary/25 p-4"
                style={{ animationDelay: "600ms" }}
              >
                <div>
                  <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Wallet before
                  </div>
                  <div className="num mt-1 text-lg">₹{money(settlement.before)}</div>
                </div>
                <ArrowUpRight className="mx-auto h-5 w-5 text-success" />
                <div className="text-right">
                  <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    Wallet after
                  </div>
                  <div className="num mt-1 text-lg text-success live-glow">
                    ₹{money(settlement.after)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Transaction log">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                <th className="pb-2 font-medium">Hash</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 text-right font-medium">Amount</th>
                <th className="pb-2 font-medium">Memo</th>
                <th className="pb-2 text-right font-medium">Timestamp</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(txs.data ?? []).map((t) => (
                <tr key={t.id} className="border-t border-border/50">
                  <td className="num py-2.5 text-primary">{shortHash(t.tx_hash)}</td>
                  <td className="num py-2.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {t.tx_type.replace("_", " ")}
                  </td>
                  <td className="py-2.5">{t.agents?.name ?? "—"}</td>
                  <td
                    className={`num py-2.5 text-right ${Number(t.amount) < 0 ? "text-violet" : "text-success"}`}
                  >
                    {Number(t.amount) < 0 ? "−" : "+"}₹{money(Math.abs(Number(t.amount)))}
                  </td>
                  <td className="max-w-[320px] truncate py-2.5 text-muted-foreground">{t.memo}</td>
                  <td className="num py-2.5 text-right text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right">
                    <StatusPill
                      label={t.status}
                      className={
                        t.status === "flagged"
                          ? "border-destructive/60 bg-destructive/15 text-destructive"
                          : "border-success/50 bg-success/12 text-success"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
