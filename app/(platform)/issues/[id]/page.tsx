import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  GraduationCap,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarList } from "@/components/charts/bar-list";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { AuditTimeline } from "@/components/issues/audit-timeline";
import { EvidenceList } from "@/components/issues/evidence-list";
import { AnalyzeIssueButton, AssignmentControls, NoteForm, StatusControls } from "@/components/issues/issue-actions";
import { RiskBreakdown } from "@/components/issues/risk-breakdown";
import { ConfidenceMeter, IssueStatusBadge, MethodBadge, RiskBadge, TrendBadge } from "@/components/shared/badges";
import { SectionLabel } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBank } from "@/lib/bank-context";
import { CATEGORY_LABELS, CHANNEL_LABELS, humanize, type Category, type Channel } from "@/lib/constants";
import { listAudit } from "@/lib/db/audit";
import { listTeams } from "@/lib/db/directory";
import {
  getCustomerSignals,
  getEvidenceMessages,
  getIssue,
  getIssueWeeklyTrend,
  listAnalyses,
  listNotes,
} from "@/lib/db/issues";
import { trendExplanation } from "@/lib/scoring/trend";
import { formatDate, formatDateTime, formatGrowth, formatMoney, formatNumber, formatPct } from "@/lib/utils/format";
import { uuid } from "@/lib/validation/api";

export const metadata: Metadata = { title: "Issue investigation" };

const ROOT_CAUSE_LABEL = {
  LIKELY: "Likely root cause",
  POSSIBLE: "Possible root cause",
  REQUIRES_INVESTIGATION: "Root cause requires investigation",
} as const;

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const bank = await requireBank();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const issue = await getIssue(bank.id, id);
  if (!issue) notFound();

  const [analyses, notes, signals, teams, audit, weekly] = await Promise.all([
    listAnalyses(bank.id, issue.id),
    listNotes(bank.id, issue.id),
    getCustomerSignals(bank.id, issue.issue_code, 8),
    listTeams(bank.id),
    listAudit(bank.id, { issueId: issue.id, limit: 30 }),
    issue.period_end ? getIssueWeeklyTrend(bank.id, issue.issue_code, issue.period_end) : Promise.resolve([]),
  ]);
  const analysis = analyses[0] ?? null;
  const evidence = analysis?.evidence ?? [];
  const evidenceMessages = await getEvidenceMessages(
    bank.id,
    evidence.map((e) => e.interaction_id),
  );
  const supporting = evidence.filter((e) => e.role === "ROOT_CAUSE");
  const counter = evidence.filter((e) => e.role === "COUNTER");
  const citedIds = new Set(supporting.map((e) => e.interaction_id));
  const canAccept = analysis?.ownership_status === "RECOMMENDED" && Boolean(analysis.primary_team_id);

  return (
    <>
      <Link
        href="/issues"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Systemic issues
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-muted-foreground font-mono text-xs">{issue.issue_code}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight uppercase">{issue.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RiskBadge level={issue.risk_level} score={issue.risk_score} />
            <TrendBadge status={issue.trend_status} />
            <IssueStatusBadge status={issue.status} />
            <span className="text-muted-foreground text-xs">
              {CATEGORY_LABELS[issue.category as Category] ?? humanize(issue.category)} · first seen{" "}
              {formatDate(issue.first_seen_at)} · last seen {formatDate(issue.last_seen_at)}
            </span>
          </div>
        </div>
        <AnalyzeIssueButton issueId={issue.id} hasAnalysis={Boolean(analysis)} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Risk"
          value={`${issue.risk_score}/100`}
          sub={`${humanize(issue.risk_level)} — see breakdown below`}
          emphasis={issue.risk_level === "CRITICAL" ? "critical" : issue.risk_level === "HIGH" ? "serious" : undefined}
        />
        <StatCard
          label={`Complaints (last ${issue.period_days} days)`}
          value={formatNumber(issue.current_period_count)}
          sub={`${formatNumber(issue.previous_period_count)} in previous ${issue.period_days} days`}
        />
        <StatCard
          label="Growth"
          value={formatGrowth(issue.growth_pct)}
          sub={trendExplanation(issue.current_period_count, issue.previous_period_count)}
        />
        <StatCard
          label="Total complaints"
          value={formatNumber(issue.total_complaints)}
          sub={`${formatPct(issue.pct_of_total, 1)} of all complaints`}
        />
        <StatCard
          label="Reported financial impact"
          value={formatMoney(issue.financial_impact, bank.currency)}
          sub="Amounts in affected transactions this period"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* ------------------------------------------------------------ left */}
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Complaint volume by week</CardTitle>
              <CardDescription>The highlighted bar is the current {issue.period_days}-day period.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyBars
                data={weekly.map((w, idx) => ({
                  label: w.week.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                  count: w.count,
                  current: idx === weekly.length - 1,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Where it is happening</CardTitle>
              <CardDescription>
                Share of complaints in the {issue.current_period_count > 0 ? "current period" : "full history"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8 md:grid-cols-2">
              <div>
                <SectionLabel>Affected channels</SectionLabel>
                <div className="mt-3">
                  <BarList
                    items={issue.channel_breakdown.map((b) => ({
                      name: b.name,
                      value: b.count,
                      secondary: `${b.pct}%`,
                    }))}
                  />
                </div>
              </div>
              <div>
                <SectionLabel>Affected products</SectionLabel>
                <div className="mt-3">
                  <BarList
                    items={issue.product_breakdown
                      .slice(0, 5)
                      .map((b) => ({ name: b.name, value: b.count, secondary: `${b.pct}%` }))}
                  />
                </div>
              </div>
              <div>
                <SectionLabel>Affected locations</SectionLabel>
                <div className="mt-3">
                  <BarList
                    items={issue.location_breakdown
                      .slice(0, 6)
                      .map((b) => ({ name: b.name, value: b.count, secondary: `${b.pct}%` }))}
                  />
                </div>
              </div>
              <div>
                <SectionLabel>Affected branches</SectionLabel>
                <div className="mt-3">
                  <BarList
                    items={issue.branch_breakdown
                      .slice(0, 6)
                      .map((b) => ({ name: b.name, value: b.count, secondary: `${b.pct}%` }))}
                    emptyLabel="No branch-linked complaints"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareQuote className="size-4" /> Customer signals
              </CardTitle>
              <CardDescription>
                Different phrasings normalised into this issue (most recent per specific issue label).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {signals.map((s) => (
                  <li key={s.id} className="border-l-2 border-[var(--series-1)]/40 pl-3">
                    <p className="text-sm">&ldquo;{s.message}&rdquo;</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 text-xs">
                      {citedIds.has(s.id) && (
                        <span className="font-medium text-[var(--series-1)]">Cited as root-cause evidence</span>
                      )}
                      <span>{CHANNEL_LABELS[s.channel as Channel] ?? s.channel}</span>
                      {(s.branch || s.location) && <span>{[s.branch, s.location].filter(Boolean).join(", ")}</span>}
                      <span className="font-mono">{s.issue}</span>
                      <span>{formatDateTime(s.occurred_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href={`/complaints?issue=${issue.issue_code}`}
                className="text-primary mt-4 inline-block text-sm font-medium hover:underline"
              >
                View all {formatNumber(issue.total_complaints)} complaints →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4" /> AI root-cause analysis
              </CardTitle>
              <CardDescription>
                A hypothesis generated from aggregated evidence — not a confirmed finding. It must be verified by the
                owning team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!analysis ? (
                <div className="bg-muted/50 text-muted-foreground rounded-lg p-4 text-sm">
                  No analysis yet. Run the AI analysis to generate a likely root cause and a responsible-team
                  recommendation.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-lg bg-[color-mix(in_oklch,var(--series-1)_6%,white)] p-4 ring-1 ring-[var(--series-1)]/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SectionLabel>{ROOT_CAUSE_LABEL[analysis.root_cause_status]}</SectionLabel>
                      <div className="flex items-center gap-2">
                        <MethodBadge method={analysis.method} model={analysis.model} />
                        <ConfidenceMeter value={analysis.root_cause_confidence} />
                      </div>
                    </div>
                    <p className="mt-2 text-base font-medium">{analysis.likely_root_cause}</p>
                  </div>
                  {supporting.length > 0 && (
                    <div>
                      <SectionLabel>Supporting evidence — customer complaints behind this hypothesis</SectionLabel>
                      <div className="mt-2">
                        <EvidenceList links={supporting} messages={evidenceMessages} />
                      </div>
                    </div>
                  )}
                  <div>
                    <SectionLabel>Observed pattern</SectionLabel>
                    <p className="mt-1 text-sm">{analysis.observed_pattern}</p>
                  </div>
                  {analysis.alternative_causes.length > 0 && (
                    <div>
                      <SectionLabel>Possible contributing factors / alternatives</SectionLabel>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                        {analysis.alternative_causes.map((c, i) => (
                          <li key={c.description}>
                            {c.description}{" "}
                            <span className="text-muted-foreground text-xs">({humanize(c.likelihood)})</span>
                            <EvidenceList
                              links={evidence.filter((e) => e.role === "ALTERNATIVE" && e.alternative_index === i)}
                              messages={evidenceMessages}
                              compact
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {counter.length > 0 && (
                    <div>
                      <SectionLabel>Doesn&apos;t fit the hypothesis — check before concluding</SectionLabel>
                      <div className="mt-2">
                        <EvidenceList links={counter} messages={evidenceMessages} tone="counter" />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <SectionLabel>Affected systems / processes</SectionLabel>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.affected_systems.length ? (
                          analysis.affected_systems.map((s) => (
                            <span key={s} className="bg-muted rounded-md px-2 py-0.5 text-xs">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">Not identified</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Recommended investigation</SectionLabel>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                        {analysis.recommended_investigation.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                  {analysis.management_insight && (
                    <div className="border-primary bg-muted/40 rounded-lg border-l-4 p-3 text-sm">
                      <span className="font-medium">Management insight: </span>
                      {analysis.management_insight}
                    </div>
                  )}
                  <div className="text-muted-foreground text-xs">Analysed {formatDateTime(analysis.created_at)}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why this risk score</CardTitle>
              <CardDescription>Deterministic scoring — each factor normalised to 0–1 and weighted.</CardDescription>
            </CardHeader>
            <CardContent>
              <RiskBreakdown factors={issue.risk_factors} score={issue.risk_score} level={issue.risk_level} />
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------- right */}
        <div className="space-y-6">
          <Card className="ring-primary/20 ring-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Recommended owner
              </CardTitle>
              <CardDescription>Selected only from this bank&apos;s team directory.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis?.feedback && analysis.feedback.corrections_supplied > 0 && (
                <div
                  className={
                    analysis.feedback.precedent_used
                      ? "flex gap-2 rounded-lg bg-[color-mix(in_oklch,var(--series-1)_8%,white)] p-2.5 text-xs ring-1 ring-[var(--series-1)]/25"
                      : "text-muted-foreground flex gap-2 text-xs"
                  }
                >
                  <GraduationCap className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {analysis.feedback.precedent_used
                      ? "Learned from your team: this recommendation follows a previous human routing correction."
                      : `Considered ${analysis.feedback.corrections_supplied} previous human routing correction${
                          analysis.feedback.corrections_supplied === 1 ? "" : "s"
                        }.`}
                  </span>
                </div>
              )}
              {!analysis ? (
                <p className="text-muted-foreground text-sm">
                  Run the AI analysis to get an owner recommendation, or assign a team manually.
                </p>
              ) : analysis.ownership_status === "RECOMMENDED" ? (
                <>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs">Department</dt>
                      <dd className="flex items-center gap-1.5 font-medium">
                        <Building2 className="text-muted-foreground size-3.5" />
                        {analysis.primary_department_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Primary team</dt>
                      <dd className="text-lg font-semibold">{analysis.primary_team_name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Confidence</dt>
                      <dd>
                        <ConfidenceMeter value={analysis.primary_team_confidence} />
                      </dd>
                    </div>
                    {analysis.secondary_teams.length > 0 && (
                      <div>
                        <dt className="text-muted-foreground text-xs">
                          Secondary team{analysis.secondary_teams.length > 1 ? "s" : ""}
                        </dt>
                        {analysis.secondary_teams.map((s) => (
                          <dd key={s.team_id} className="mt-1">
                            <span className="font-medium">{s.team_name}</span>
                            <span className="text-muted-foreground block text-xs">{s.reason}</span>
                          </dd>
                        ))}
                      </div>
                    )}
                    {analysis.ownership_reason && (
                      <div>
                        <dt className="text-muted-foreground text-xs">Reason</dt>
                        <dd>{analysis.ownership_reason}</dd>
                      </div>
                    )}
                  </dl>
                </>
              ) : (
                <div className="flex gap-2 rounded-lg bg-[color-mix(in_oklch,var(--status-serious)_12%,white)] p-3 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--status-serious)]" />
                  <div>
                    <div className="font-medium">
                      {analysis.ownership_status === "NO_CLEAR_OWNER" ? "NO_CLEAR_OWNER" : "Recommendation rejected"}
                    </div>
                    <p className="text-muted-foreground">
                      {analysis.ownership_status === "NO_CLEAR_OWNER"
                        ? "No team in the directory has responsibilities covering this issue. Manual assignment required."
                        : "The AI referenced a team that is not in this bank's directory, so the result was rejected. Manual assignment required."}
                    </p>
                    {analysis.validation_notes.length > 0 && (
                      <ul className="text-muted-foreground mt-2 list-disc pl-4 text-xs">
                        {analysis.validation_notes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {analysis && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    <Wrench className="size-3.5" /> Recommended action
                  </div>
                  <p className="mt-1 text-sm">{analysis.recommended_action}</p>
                </div>
              )}

              {issue.assigned_team_name && (
                <div className="rounded-lg bg-[color-mix(in_oklch,var(--status-good)_10%,white)] p-3 text-sm">
                  Assigned to <span className="font-semibold">{issue.assigned_team_name}</span> (
                  {issue.assigned_department_name})
                  <div className="text-muted-foreground text-xs">
                    {issue.assignment_source === "MANUAL_OVERRIDE" ? "Human override" : "AI recommendation accepted"} ·{" "}
                    {formatDateTime(issue.assigned_at)}
                  </div>
                </div>
              )}

              {issue.status !== "RESOLVED" && (
                <AssignmentControls
                  issueId={issue.id}
                  analysisId={analysis?.id ?? null}
                  canAccept={canAccept && issue.assigned_team_id !== analysis?.primary_team_id}
                  recommendedTeamName={analysis?.primary_team_name ?? null}
                  assignedTeamId={issue.assigned_team_id}
                  teams={teams}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4" /> Status
              </CardTitle>
              <CardDescription>Open → Assigned → Investigating → Resolved</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <IssueStatusBadge status={issue.status} />
              <StatusControls issueId={issue.id} status={issue.status} assigned={Boolean(issue.assigned_team_id)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteForm issueId={issue.id} />
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {n.author} · {formatDateTime(n.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4" /> Audit trail
              </CardTitle>
              <CardDescription>AI recommendations and human decisions for this issue.</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTimeline entries={audit} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
