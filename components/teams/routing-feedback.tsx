import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeedbackStats, RoutingDecision } from "@/lib/ai/feedback";
import { formatDateTime } from "@/lib/utils/format";

const KIND_LABEL = { CORRECTION: "Corrected", MANUAL: "Assigned manually", CONFIRMED: "Accepted" } as const;

/** Human feedback loop: how managers' routing decisions feed back into recommendations. */
export function RoutingFeedbackCard({ stats, decisions }: { stats: FeedbackStats; decisions: RoutingDecision[] }) {
  const seen = new Set<string>();
  const lessons = decisions
    .filter((d) => d.kind !== "CONFIRMED")
    .filter((d) => {
      const key = `${d.issueId}:${d.assignedTeamId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-4" /> Learning from routing decisions
        </CardTitle>
        <CardDescription>
          Every time a manager accepts, corrects or manually assigns an owner, the decision and reason are fed back into
          future team recommendations for similar issues — so routing adapts to how this bank actually works.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">AI owner accepted</dt>
            <dd className="text-xl font-semibold">
              {stats.acceptanceRate === null ? "—" : `${Math.round(stats.acceptanceRate * 100)}%`}
            </dd>
            <dd className="text-muted-foreground text-xs">of recommendations a manager decided on</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Accepted</dt>
            <dd className="text-xl font-semibold">{stats.confirmed}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Corrected</dt>
            <dd className="text-xl font-semibold">{stats.corrected}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assigned manually</dt>
            <dd className="text-xl font-semibold">{stats.manual}</dd>
          </div>
        </dl>

        {lessons.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No corrections yet. When a manager assigns a different team than the AI recommended, it appears here and is
            used as a precedent for future recommendations.
          </p>
        ) : (
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              Lessons in use
            </div>
            <ul className="divide-y text-sm">
              {lessons.map((d) => (
                <li
                  key={d.issueId}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <Link href={`/issues/${d.issueId}`} className="font-medium hover:underline">
                      {d.issueTitle}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">{KIND_LABEL[d.kind]}:</span>
                      {d.recommendedTeamName && (
                        <>
                          <span className="text-muted-foreground line-through">{d.recommendedTeamName}</span>
                          <ArrowRight className="text-muted-foreground size-3" />
                        </>
                      )}
                      <span className="font-medium">{d.assignedTeamName}</span>
                    </div>
                    {d.reason && (
                      <p className="text-muted-foreground mt-0.5 text-xs italic">&ldquo;{d.reason}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {d.actor} · {formatDateTime(d.decidedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
