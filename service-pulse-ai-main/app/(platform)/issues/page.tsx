import { Siren } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OwnerLine } from "@/components/dashboard/early-warning-list";
import { IssueStatusBadge, RiskBadge, SeverityBadge, TrendBadge } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { AnalyzeSignificantButton, RecomputeButton } from "@/components/shared/pipeline-actions";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBank } from "@/lib/bank-context";
import { RISK_LEVELS, TREND_LABELS, TREND_STATUSES, humanize } from "@/lib/constants";
import { listIssues, type IssueView } from "@/lib/db/issues";
import { formatDate, formatGrowth, formatNumber, formatPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Systemic issues" };

const VIEWS: { value: IssueView; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved (history)" },
  { value: "all", label: "All" },
];

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const bank = await requireBank();
  const params = await searchParams;
  const view: IssueView = VIEWS.some((v) => v.value === params.view) ? (params.view as IssueView) : "active";
  const trend = TREND_STATUSES.includes(params.trend as never) ? params.trend : undefined;
  const risk = RISK_LEVELS.includes(params.risk as never) ? params.risk : undefined;
  const issues = await listIssues(bank.id, { view, trend, risk });

  const link = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { view, trend, risk, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "view" && v === "active")) next.set(k, v);
    const qs = next.toString();
    return qs ? `/issues?${qs}` : "/issues";
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
      active
        ? "bg-primary text-primary-foreground ring-primary"
        : "bg-card text-muted-foreground ring-border hover:text-foreground",
    );

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Systemic issues"
        description="Semantically similar complaints normalised into issue groups. Growth, trend status and risk are calculated deterministically; root cause and owner are AI recommendations that a human confirms."
        actions={
          <>
            <RecomputeButton />
            <AnalyzeSignificantButton />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link key={v.value} href={link({ view: v.value })} className={chip(view === v.value)}>
            {v.label}
          </Link>
        ))}
        <span className="bg-border mx-1 h-4 w-px" />
        <Link href={link({ trend: undefined })} className={chip(!trend)}>
          Any trend
        </Link>
        {TREND_STATUSES.map((t) => (
          <Link key={t} href={link({ trend: t })} className={chip(trend === t)}>
            {TREND_LABELS[t]}
          </Link>
        ))}
        <span className="bg-border mx-1 h-4 w-px" />
        <Link href={link({ risk: undefined })} className={chip(!risk)}>
          Any risk
        </Link>
        {RISK_LEVELS.map((r) => (
          <Link key={r} href={link({ risk: r })} className={chip(risk === r)}>
            {humanize(r)}
          </Link>
        ))}
      </div>

      {issues.length === 0 ? (
        <EmptyState icon={<Siren className="size-8" />} title="No issues in this view">
          {view === "resolved" ? "Resolved issues appear here as history." : "Classify interactions to detect issues."}
        </EmptyState>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-4">Issue</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="text-right">This vs previous</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                  <TableHead className="text-right">Total · share</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="pl-4">
                      <Link href={`/issues/${i.id}`} className="font-medium hover:underline">
                        {i.title}
                      </Link>
                      <div className="text-muted-foreground font-mono text-[11px]">{i.issue_code}</div>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={i.risk_level} score={i.risk_score} />
                    </TableCell>
                    <TableCell>
                      <TrendBadge status={i.trend_status} />
                    </TableCell>
                    <TableCell className="tabular text-right">
                      <span className="font-medium">{formatNumber(i.current_period_count)}</span>
                      <span className="text-muted-foreground"> vs {formatNumber(i.previous_period_count)}</span>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatGrowth(i.growth_pct)}</TableCell>
                    <TableCell className="tabular text-right">
                      {formatNumber(i.total_complaints)}{" "}
                      <span className="text-muted-foreground">· {formatPct(i.pct_of_total, 1)}</span>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={i.severity} />
                    </TableCell>
                    <TableCell className="max-w-56 min-w-44 whitespace-normal">
                      <OwnerLine issue={i} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <IssueStatusBadge status={i.status} />
                      {i.resolved_at && (
                        <div className="text-muted-foreground mt-1 text-[11px]">{formatDate(i.resolved_at)}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}
