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
        "bg-card ring-foreground/10 flex h-full flex-col justify-between gap-3 rounded-xl p-4 ring-1 transition-shadow",
        href && "hover:ring-foreground/20 hover:shadow-md",
        emphasis === "critical" && "border-l-4 border-l-[var(--status-critical)]",
        emphasis === "serious" && "border-l-4 border-l-[var(--status-serious)]",
        emphasis === "warning" && "border-l-4 border-l-[var(--status-warning)]",
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {Icon && <Icon className="size-4" />}
      </div>
      <div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
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
