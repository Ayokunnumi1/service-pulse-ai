import { ArrowRight, UserRoundCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { RiskBadge, TrendBadge } from "@/components/shared/badges";
import { formatGrowth, formatNumber } from "@/lib/utils/format";
import type { Issue } from "@/types";

export function OwnerLine({ issue }: { issue: Issue }) {
  if (issue.assigned_team_name) {
    return (
      <span className="text-xs">
        <UserRoundCheck className="mr-1 inline size-3.5 align-[-3px] text-[var(--status-good)]" />
        Assigned: <span className="font-medium">{issue.assigned_team_name}</span>
      </span>
    );
  }
  if (issue.ownership_status === "RECOMMENDED" && issue.recommended_team_name) {
    return (
      <span className="text-muted-foreground text-xs">
        <UserRoundCheck className="mr-1 inline size-3.5 align-[-3px]" />
        Recommended: <span className="text-foreground font-medium">{issue.recommended_team_name}</span> ·{" "}
        {issue.recommended_department_name}
      </span>
    );
  }
  if (issue.ownership_status) {
    return (
      <span className="text-muted-foreground text-xs">
        <UserRoundX className="mr-1 inline size-3.5 align-[-3px] text-[var(--status-serious)]" />
        No clear owner — manual assignment required
      </span>
    );
  }
  return <span className="text-muted-foreground text-xs">Not yet analysed</span>;
}

export function EarlyWarningList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No significant issues detected in the current period.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Link href={`/issues/${issue.id}`} className="group flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium group-hover:underline">{issue.title}</span>
                <TrendBadge status={issue.trend_status} />
                <RiskBadge level={issue.risk_level} score={issue.risk_score} />
              </div>
              <div className="mt-1">
                <OwnerLine issue={issue} />
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="tabular text-lg font-semibold">{formatGrowth(issue.growth_pct)}</div>
              <div className="tabular text-muted-foreground text-xs">
                {formatNumber(issue.current_period_count)} vs {formatNumber(issue.previous_period_count)}
              </div>
            </div>
            <ArrowRight className="text-muted-foreground size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
