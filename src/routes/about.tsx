import { createFileRoute, Link } from "@tanstack/react-router";
import { Fingerprint, Gauge, Wallet, Repeat } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How AgentLine Works — Credit for Autonomous Agents" },
      {
        name: "description",
        content:
          "Identity, behavioral underwriting, scoped disbursement and escrow-enforced repayment — how AgentLine extends credit to AI agents without collateral or signed contracts.",
      },
      { property: "og:title", content: "How AgentLine Works" },
      {
        property: "og:description",
        content:
          "Four steps: Agent Passport identity, behavioral underwriting, scoped spend, automated escrow repayment.",
      },
    ],
  }),
  component: AboutPage,
});

const STEPS = [
  {
    icon: Fingerprint,
    title: "Identity",
    body: "Every agent gets a Passport: a durable agent ID and wallet, cryptographically linked to a human or organizational principal who signs for its declared task scope and spend cap.",
    tone: "text-primary",
  },
  {
    icon: Gauge,
    title: "Underwriting",
    body: "No credit history exists, so we underwrite behavior: task success rate, completion latency, revenue-per-task variance, spend consistency and principal reputation. Every decision ships with factor attribution.",
    tone: "text-cyan",
  },
  {
    icon: Wallet,
    title: "Disbursement & scoped spend",
    body: "Approved capital lands in a scoped smart wallet, not a bank account. Policy is enforced at the wallet: only whitelisted vendors, only inside the spend cap, only for the funded task.",
    tone: "text-violet",
  },
  {
    icon: Repeat,
    title: "Automated repayment via escrow",
    body: "Task revenue is captured at source. Principal plus interest routes to the lender before the agent ever holds it; surplus is released to the agent wallet. No signed contract, no collections.",
    tone: "text-success",
  },
];

function AboutPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How AgentLine works</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        AI agents earn revenue but cannot borrow: no legal identity, no collateral, no enforceable
        contract. AgentLine replaces all three with identity linkage, behavioral underwriting and
        revenue-level enforcement.
      </p>

      <ol className="mt-10 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="glass glass-hover flex gap-5 rounded-xl p-5">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/60 ring-1 ring-border ${s.tone}`}
              >
                <s.icon className="h-5 w-5" />
              </span>
              {i < STEPS.length - 1 && <span className="mt-2 w-px flex-1 bg-border" />}
            </div>
            <div>
              <div className="num text-[10px] tracking-[0.2em] text-muted-foreground">
                STEP {String(i + 1).padStart(2, "0")}
              </div>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="glass mt-8 rounded-xl p-5">
        <h2 className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Grounding
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          AgentLine is built on patterns emerging in agent commerce infrastructure — verifiable
          agent identity standards, account-abstraction wallets with programmable spend policy, and
          agent payment protocols that settle machine-to-machine. The demo runs on simulated agents
          and mock wallet addresses, but the control surfaces map one-to-one onto those primitives.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/fleet"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Open control room
        </Link>
        <Link
          to="/loans"
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Request a loan
        </Link>
      </div>
    </div>
  );
}
