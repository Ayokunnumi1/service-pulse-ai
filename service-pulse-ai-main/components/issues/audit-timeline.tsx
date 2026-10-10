import { humanize } from "@/lib/constants";
import { formatConfidence, formatDateTime } from "@/lib/utils/format";
import type { AuditEntry } from "@/types";

const EVENT_LABEL: Record<string, string> = {
  ROOT_CAUSE_ANALYSIS: "Root-cause analysis",
  TEAM_RECOMMENDATION: "Team recommended",
  RECOMMENDATION_REJECTED: "AI recommendation rejected",
  ISSUE_ASSIGNED: "Issue assigned",
  STATUS_CHANGED: "Status changed",
  NOTE_ADDED: "Note added",
};

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-muted-foreground text-sm">No audited events yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-4">
      {entries.map((e) => (
        <li key={e.id} className="text-sm">
          <span className="border-card absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 bg-[var(--series-1)]" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-medium">{EVENT_LABEL[e.event_type] ?? humanize(e.event_type)}</span>
            <span className="text-muted-foreground text-xs">{formatDateTime(e.created_at)}</span>
          </div>
          <div className="text-muted-foreground text-xs">
            by {e.actor}
            {e.method && ` · ${e.method === "AI" ? `AI${e.model ? ` (${e.model})` : ""}` : "rules fallback"}`}
          </div>
          <div className="mt-1 space-y-0.5 text-xs">
            {e.root_cause && <div>Root cause: {e.root_cause}</div>}
            {e.recommended_team_name && (
              <div>
                Recommended: {e.recommended_team_name}
                {e.confidence !== null && ` (${formatConfidence(e.confidence)})`}
              </div>
            )}
            {e.assigned_team_name && e.event_type === "ISSUE_ASSIGNED" && (
              <div>
                Assigned: {e.assigned_team_name}
                {e.human_override && (
                  <span className="ml-1 font-medium text-[var(--status-serious)]">· human override</span>
                )}
              </div>
            )}
            {e.event_type === "STATUS_CHANGED" && e.final_status && <div>New status: {humanize(e.final_status)}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
