"use client";

import { BrainCircuit, Building2, FlaskConical, Inbox, LayoutDashboard, Settings, Siren } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Executive dashboard", icon: LayoutDashboard },
  { href: "/issues", label: "Systemic issues", icon: Siren },
  { href: "/complaints", label: "Customer interactions", icon: Inbox },
  { href: "/teams", label: "Teams & impact", icon: Building2 },
  { href: "/insights", label: "Ask ServicePulse", icon: BrainCircuit },
  { href: "/evaluation", label: "AI evaluation", icon: FlaskConical },
  { href: "/settings", label: "Settings & audit", icon: Settings },
];

export function Sidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col lg:flex">
      <div className="px-5 py-5">
        <Logo inverted />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className={cn("size-4", active && "text-[var(--sidebar-primary)]")} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/issues" && alertCount > 0 && (
                <span className="tabular rounded-full bg-[var(--status-critical)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-sidebar-border text-sidebar-foreground/60 border-t px-5 py-4 text-[11px] leading-relaxed">
        Root causes are AI hypotheses that require investigation. All recommendations are audited.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="bg-card flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
            pathname.startsWith(item.href) ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
