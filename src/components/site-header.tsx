import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/loans", label: "Loan Desk" },
  { to: "/escrow", label: "Escrow" },
  { to: "/risk", label: "Risk" },
  { to: "/about", label: "How it works" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/40">
            <Activity className="h-4 w-4 text-primary" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Agent<span className="text-primary">Line</span>
          </span>
        </Link>
        <nav className="scrollbar-none -mx-1 flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-foreground bg-secondary/70" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="rounded-md px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success live-glow text-success" />
          <span className="num text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Protocol live
          </span>
        </div>
      </div>
    </header>
  );
}
