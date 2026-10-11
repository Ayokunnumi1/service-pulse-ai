import { AlertTriangle, Newspaper } from "lucide-react";
import Link from "next/link";
import { MethodBadge } from "@/components/shared/badges";
import type { BriefingView } from "@/lib/ai/briefing";
import { formatDateTime } from "@/lib/utils/format";
import { GenerateBriefingButton } from "./briefing";

/** Today's briefing: three-point executive summary at the top of the dashboard. */
export function BriefingCard({ view, bankName }: { view: BriefingView | null; bankName: string }) {
  return (
    <section className="bg-card ring-foreground/10 mb-6 rounded-xl p-5 ring-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-[var(--series-1)]" />
          <h2 className="font-semibold">Today&apos;s briefing</h2>
          <span className="text-muted-foreground text-sm">· {bankName}</span>
        </div>
        <div className="flex items-center gap-2">
          {view && <MethodBadge method={view.method} model={view.model} />}
          <GenerateBriefingButton hasBriefing={Boolean(view)} stale={view?.stale ?? false} />
        </div>
      </div>

      {!view ? (
        <p className="text-muted-foreground mt-3 text-sm">
          A three-point summary of what matters right now — what is going wrong, how fast, likely why, and who owns it —
          written from this bank&apos;s computed data.
        </p>
      ) : (
        <>
          <p className="mt-3 text-base font-medium">{view.briefing.headline}</p>
          {view.briefing.points.length > 0 && (
            <ol className="mt-3 grid gap-3 md:grid-cols-3">
              {view.briefing.points.map((p, idx) => {
                const id = p.issue_codes.map((c) => view.issueLinks[c]).find(Boolean);
                const body = (
                  <>
                    <div className="text-muted-foreground text-xs font-semibold">{idx + 1}</div>
                    <div className="mt-0.5 text-sm font-medium">{p.title}</div>
                    <p className="text-muted-foreground mt-1 text-sm">{p.detail}</p>
                  </>
                );
                return (
                  <li key={idx} className="bg-muted/40 rounded-lg p-3">
                    {id ? (
                      <Link
                        href={`/issues/${id}`}
                        className="block hover:underline-offset-2 [&_.font-medium]:hover:underline"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="border-primary bg-muted/40 mt-3 rounded-lg border-l-4 p-3 text-sm">
            <span className="font-medium">Recommended focus: </span>
            {view.briefing.recommended_focus}
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>
              Written {formatDateTime(view.generatedAt)} · figures computed by ServicePulse
              {view.method === "AI" ? ", phrased by AI" : ", deterministic summary"}
            </span>
            {view.stale && (
              <span className="flex items-center gap-1 text-[var(--status-serious)]">
                <AlertTriangle className="size-3.5" /> Data has changed since this briefing — refresh it
              </span>
            )}
            {view.briefing.data_limitations && <span>{view.briefing.data_limitations}</span>}
          </div>
        </>
      )}
    </section>
  );
}
