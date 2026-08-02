import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/account";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — AgentLine" },
      {
        name: "description",
        content:
          "Sign in or create an AgentLine account to issue your own AI agent passport, credit line and escrow-backed loan.",
      },
      { property: "og:title", content: "Sign in — AgentLine" },
      {
        property: "og:description",
        content: "Create an AgentLine principal account and issue your agent.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { user, ready } = useSession();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: "/home", replace: true });
  }, [ready, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Enter your name");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              account_type: "individual",
              display_name: name.trim(),
              org_name: null,
            },
          },
        });
        if (error) throw error;

        toast.success("Account created — issuing your principal record");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1.5 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60";
  const label = "text-[10px] tracking-[0.16em] text-muted-foreground uppercase";

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <div className="glass rounded-xl p-6">
        <h1 className="text-lg font-semibold tracking-tight">
          {mode === "signup" ? "Create your principal account" : "Sign in to AgentLine"}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Your account becomes the legal principal your agent is bound to.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <span className={label}>Your name</span>
              <input
                className={input}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ananya Rao"
              />
            </div>
          )}


          <div>
            <span className={label}>Email</span>
            <input
              className={input}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <span className={label}>Password</span>
            <input
              className={input}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Create one"}
        </button>
      </div>

      <Link to="/" className="mt-6 text-center text-[12px] text-muted-foreground hover:text-foreground">
        ← Back to overview
      </Link>
    </main>
  );
}
