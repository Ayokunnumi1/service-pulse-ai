import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** KPI tile: the number is the chart. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  href?: string;
  emphasis?: "critical" | "serious" | "warning";
}) {
  const body = (
    <div
      className={cn(
        "liquid-glass liquid-mirror liquid-mirror-floor flex h-full flex-col justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-all duration-300",
        href && "hover:ring-foreground/20 hover:shadow-xl hover:-translate-y-0.5",
        emphasis === "critical" && "border-l-4 border-l-[var(--status-critical)] bg-gradient-to-br from-[var(--status-critical)]/[0.04] to-transparent",
        emphasis === "serious" && "border-l-4 border-l-[var(--status-serious)] bg-gradient-to-br from-[var(--status-serious)]/[0.04] to-transparent",
        emphasis === "warning" && "border-l-4 border-l-[var(--status-warning)] bg-gradient-to-br from-[var(--status-warning)]/[0.04] to-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.04] text-muted-foreground border border-border/40">
            <Icon className="size-3.5" />
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-muted-foreground mt-1 text-xs leading-relaxed">{sub}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
