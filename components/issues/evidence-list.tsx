import { CHANNEL_LABELS, type Channel } from "@/lib/constants";
import type { EvidenceLink } from "@/lib/ai/evidence";
import type { EvidenceMessage } from "@/lib/db/issues";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/** Customer messages cited by a root-cause analysis, with the model's reason for each. */
export function EvidenceList({
  links,
  messages,
  tone = "support",
  compact = false,
}: {
  links: EvidenceLink[];
  messages: Map<string, EvidenceMessage>;
  tone?: "support" | "counter";
  compact?: boolean;
}) {
  const items = links.filter((l) => messages.has(l.interaction_id));
  if (items.length === 0) return null;
  return (
    <ul className={cn("space-y-2", compact && "mt-1 space-y-1")}>
      {items.map((l) => {
        const m = messages.get(l.interaction_id)!;
        return (
          <li
            key={`${l.role}-${l.alternative_index}-${l.interaction_id}`}
            className={cn(
              "border-l-2 pl-3",
              tone === "support" ? "border-[var(--series-1)]" : "border-[var(--status-warning)]",
            )}
          >
            <p className={compact ? "text-xs" : "text-sm"}>&ldquo;{m.message}&rdquo;</p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
              <span>{CHANNEL_LABELS[m.channel as Channel] ?? m.channel}</span>
              {(m.branch || m.location) && <span>{[m.branch, m.location].filter(Boolean).join(", ")}</span>}
              <span>{formatDateTime(m.occurred_at)}</span>
              {m.customer_reference && <span className="font-mono">{m.customer_reference}</span>}
            </div>
            {l.why && !compact && <p className="mt-1 text-xs italic">{l.why}</p>}
          </li>
        );
      })}
    </ul>
  );
}
