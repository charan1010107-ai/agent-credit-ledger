import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/account";

const AUTHED_NAV = [
  { to: "/home", label: "My Agent" },
  { to: "/fleet", label: "Explore the Fleet" },
  { to: "/loans", label: "Loan Desk" },
  { to: "/escrow", label: "Escrow" },
  { to: "/risk", label: "Risk" },
  { to: "/about", label: "How it works" },
] as const;

const PUBLIC_NAV = [{ to: "/about", label: "How it works" }] as const;

export function SiteHeader() {
  const { user, ready } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const nav = user ? AUTHED_NAV : PUBLIC_NAV;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link to={user ? "/home" : "/"} className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/40">
            <Activity className="h-4 w-4 text-primary" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Agent<span className="text-primary">Line</span>
          </span>
        </Link>
        <nav className="scrollbar-none -mx-1 flex flex-1 items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "text-foreground bg-secondary/70" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="rounded-md px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {ready &&
          (user ? (
            <button
              onClick={signOut}
              className="hidden rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="hidden rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground sm:block"
            >
              Sign in
            </Link>
          ))}
      </div>
    </header>
  );
}
