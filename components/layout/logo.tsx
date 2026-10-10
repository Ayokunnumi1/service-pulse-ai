import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-white shadow-sm">
        <Activity className="size-4.5" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className={cn("text-[15px] font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>
          ServicePulse <span className="text-[var(--sidebar-primary)]">AI</span>
        </div>
        <div
          className={cn(
            "text-[10px] tracking-wide uppercase",
            inverted ? "text-sidebar-foreground/70" : "text-muted-foreground",
          )}
        >
          SLA Operations
        </div>
      </div>
    </div>
  );
}
