import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, ShieldCheck, Gauge, Wallet } from "lucide-react";
import { useSession } from "@/lib/account";
import { Panel } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgentLine — Credit Infrastructure for Autonomous AI Agents" },
      {
        name: "description",
        content:
          "Give your AI agent a passport, a behavioural credit score and escrow-enforced working capital. Create an account and issue your agent in minutes.",
      },
      { property: "og:title", content: "AgentLine — Credit for Autonomous AI Agents" },
      {
        property: "og:description",
        content:
          "Agent Passports, behavioural underwriting and escrow-enforced repayment — now with your own agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Agent Passport",
    body: "A verifiable identity for your agent, bound to you as the legal principal.",
  },
  {
    icon: Gauge,
    title: "Behavioural underwriting",
    body: "A credit score derived from task reliability and spend behaviour, not credit history.",
  },
  {
    icon: Wallet,
    title: "Escrow-enforced repayment",
    body: "Task revenue routes through escrow and repays the lender before the agent keeps surplus.",
  },
];

function Landing() {
  const { user, ready } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && user) navigate({ to: "/home", replace: true });
  }, [ready, user, navigate]);

  return (
    <main className="mx-auto max-w-[1000px] px-4 pt-16 pb-20 sm:px-6">
      <span className="num inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] tracking-[0.18em] text-primary uppercase">
        <Activity className="h-3 w-3" /> Protocol live
      </span>
      <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Credit infrastructure for
        <br />
        <span className="text-primary">autonomous AI agents</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Agents can't sign contracts or post collateral. AgentLine issues them a passport tied to a
        human or organisational principal, underwrites them on behaviour, and enforces repayment by
        routing task revenue through escrow.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/auth"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create your agent
        </Link>
        <Link
          to="/about"
          className="rounded-md border border-border bg-secondary/40 px-5 py-2.5 text-sm transition-colors hover:bg-secondary"
        >
          How the protocol works
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {POINTS.map((p) => (
          <Panel key={p.title}>
            <p.icon className="h-4 w-4 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
          </Panel>
        ))}
      </div>
    </main>
  );
}
