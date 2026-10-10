import { AlertOctagon, ArrowRight, ClipboardList, Inbox, MessageSquareWarning, Radar, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/charts/bar-list";
import { TrendChart } from "@/components/charts/trend-chart";
import { EarlyWarningList } from "@/components/dashboard/early-warning-list";
import { PageHeader } from "@/components/shared/page-header";
import { AnalyzeSignificantButton, ClassifyButton } from "@/components/shared/pipeline-actions";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBank } from "@/lib/bank-context";
import { issueColor, OTHER_COLOR } from "@/lib/chart-colors";
import { getIssuesByOwner, getKpis, getTopBreakdowns, getTrendSeries } from "@/lib/db/dashboard";
import { listIssues } from "@/lib/db/issues";
import { SIGNIFICANT_TRENDS } from "@/lib/scoring/trend";
import { formatDate, formatGrowth, formatNumber } from "@/lib/utils/format";
import { growthPercent } from "@/lib/scoring/trend";

export const metadata: Metadata = { title: "Executive dashboard" };

export default async function DashboardPage() {
  const bank = await requireBank();
  const [kpis, trend, owners, breakdowns, issues] = await Promise.all([
    getKpis(bank.id),
    getTrendSeries(bank.id),
    getIssuesByOwner(bank.id),
    getTopBreakdowns(bank.id),
    listIssues(bank.id, { view: "active" }),
  ]);

  const significant = issues.filter(
    (i) => SIGNIFICANT_TRENDS.includes(i.trend_status) || i.risk_level === "CRITICAL" || i.risk_level === "HIGH",
  );
  const unanalysed = significant.filter((i) => !i.analysis_id).length;
  const complaintGrowth = growthPercent(kpis.currentPeriodComplaints, kpis.previousPeriodComplaints);

  const issueCodeByTitle = new Map(issues.map((i) => [i.title, i.issue_code]));
  const series = trend.series.map((title) => ({
    key: title,
    color: title === "Other" ? OTHER_COLOR : issueColor(issueCodeByTitle.get(title) ?? ""),
  }));

  // Teams roll up into their department; unowned issues keep their bucket ("No clear owner" / "Not yet analysed").
  const departments = new Map<string, { value: number; unowned: boolean }>();
  for (const o of owners) {
    const key = o.kind === "TEAM" ? (o.department ?? o.name) : o.name;
    const entry = departments.get(key) ?? { value: 0, unowned: o.kind !== "TEAM" };
    entry.value += o.issues;
    departments.set(key, entry);
  }
  const departmentItems = [...departments.entries()]
    .sort((a, b) => Number(a[1].unowned) - Number(b[1].unowned) || b[1].value - a[1].value)
    .map(([name, { value, unowned }]) => ({ name, value, href: unowned ? "/issues" : "/teams" }));
  const criticalNote = (n: number) => (n > 0 ? `(${n} critical)` : undefined);

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Executive dashboard"
        description={
          kpis.periodEnd
            ? `Current period: the ${kpis.periodDays} days ending ${formatDate(kpis.periodEnd)}, compared with the previous ${kpis.periodDays} days. All metrics are calculated deterministically from classified interactions.`
            : "No classified interactions yet."
        }
        actions={
          <>
            {kpis.pending > 0 && kpis.classified > 0 && <ClassifyButton pending={kpis.pending} />}
            {unanalysed > 0 && <AnalyzeSignificantButton variant={kpis.pending > 0 ? "outline" : "default"} />}
          </>
        }
      />

      {kpis.classified === 0 && kpis.pending > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-(--series-1)/30 bg-[color-mix(in_oklch,var(--series-1)_6%,white)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">
              {formatNumber(kpis.pending)} customer interactions are waiting for AI classification
            </div>
            <p className="text-muted-foreground text-sm">
              Classification detects category, intent, sentiment, severity and the normalised issue group, then the
              early-warning engine calculates trends and risk.
            </p>
          </div>
          <ClassifyButton pending={kpis.pending} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total interactions"
          icon={Inbox}
          value={formatNumber(kpis.totalInteractions)}
          sub={`${formatNumber(kpis.pending)} awaiting classification`}
          href="/complaints"
        />
        <StatCard
          label="Total complaints"
          icon={MessageSquareWarning}
          value={formatNumber(kpis.totalComplaints)}
          sub={`${formatNumber(kpis.currentPeriodComplaints)} this period (${formatGrowth(complaintGrowth)})`}
          href="/complaints?intent=COMPLAINT"
        />
        <StatCard
          label="Emerging issues"
          icon={Radar}
          value={formatNumber(kpis.emergingIssues)}
          sub="Emerging, high concern or critical growth"
          emphasis={kpis.emergingIssues > 0 ? "warning" : undefined}
          href="/issues"
        />
        <StatCard
          label="Critical-risk issues"
          icon={AlertOctagon}
          value={formatNumber(kpis.criticalIssues)}
          sub="Risk score ≥ 75 / 100"
          emphasis={kpis.criticalIssues > 0 ? "critical" : undefined}
          href="/issues?risk=CRITICAL"
        />
        <StatCard
          label="Require investigation"
          icon={Search}
          value={formatNumber(kpis.requiringInvestigation)}
          sub="Significant issues not yet under investigation"
          emphasis={kpis.requiringInvestigation > 0 ? "serious" : undefined}
          href="/issues"
        />
        <StatCard
          label="AI-classified"
          icon={ClipboardList}
          value={kpis.classified ? `${Math.round((kpis.aiClassified / kpis.classified) * 100)}%` : "—"}
          sub={`${formatNumber(kpis.classified - kpis.aiClassified)} via rules fallback`}
          href="/settings"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Early-warning alerts</CardTitle>
            <CardDescription>Significant issues ranked by deterministic risk score, with likely owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <EarlyWarningList issues={significant.slice(0, 6)} />
            {significant.length > 6 && (
              <Link
                href="/issues"
                className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                View all {significant.length} significant issues <ArrowRight className="size-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Issues by department</CardTitle>
            <CardDescription>Significant issues by assigned or recommended owner</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={departmentItems} emptyLabel="No significant issues" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Complaint trend over time</CardTitle>
            <CardDescription>Weekly complaints for the five largest issue groups this period</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.rows.length > 0 ? (
              <TrendChart data={trend.rows} series={series} />
            ) : (
              <p className="text-muted-foreground py-16 text-center text-sm">Classify interactions to see trends.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Issues by team</CardTitle>
            <CardDescription>Significant issues per owning team</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={owners.slice(0, 8).map((o) => ({
                name: o.name,
                value: o.issues,
                secondary: criticalNote(o.critical),
                href: o.kind === "TEAM" ? "/teams" : "/issues",
              }))}
              emptyLabel="No significant issues"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top complaint categories</CardTitle>
            <CardDescription>All complaints · this period in brackets</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={breakdowns.categories.map((c) => ({ name: c.name, value: c.count, secondary: `(${c.current})` }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top affected products</CardTitle>
            <CardDescription>All complaints · this period in brackets</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={breakdowns.products.map((c) => ({ name: c.name, value: c.count, secondary: `(${c.current})` }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top affected branches</CardTitle>
            <CardDescription>Ranked by complaints this period · total in brackets</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={breakdowns.branches.map((c) => ({ name: c.name, value: c.current, secondary: `(${c.count})` }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
