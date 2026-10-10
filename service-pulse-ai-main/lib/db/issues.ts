import "server-only";
import type { IssueStatus } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import type { Issue, IssueAnalysis, IssueNote } from "@/types";

const issueColumns = () => sql`
  s.id, s.issue_code, s.title, s.category, s.status, s.trend_status, s.risk_level, s.risk_score,
  s.risk_factors, s.total_complaints, s.pct_of_total, s.current_period_count, s.previous_period_count,
  s.growth_pct, s.severity, s.channel_breakdown, s.product_breakdown, s.location_breakdown,
  s.branch_breakdown, s.financial_impact, s.period_days, s.period_end, s.first_seen_at, s.last_seen_at,
  s.assigned_team_id, t.name as assigned_team_name, d.name as assigned_department_name, s.assigned_at,
  s.assignment_source, s.resolved_at, s.metrics_updated_at,
  a.id as analysis_id, rt.name as recommended_team_name, rd.name as recommended_department_name,
  a.ownership_status`;

const issueJoins = () => sql`
  left join teams t on t.id = s.assigned_team_id and t.bank_id = s.bank_id
  left join departments d on d.id = t.department_id and d.bank_id = t.bank_id
  left join lateral (
    select x.id, x.primary_team_id, x.primary_department_id, x.ownership_status
    from issue_analyses x
    where x.issue_id = s.id and x.bank_id = s.bank_id
    order by x.created_at desc
    limit 1
  ) a on true
  left join teams rt on rt.id = a.primary_team_id and rt.bank_id = s.bank_id
  left join departments rd on rd.id = a.primary_department_id and rd.bank_id = s.bank_id`;

export type IssueView = "active" | "resolved" | "all";

export async function listIssues(
  bankId: string,
  opts: { view?: IssueView; trend?: string; risk?: string } = {},
): Promise<Issue[]> {
  const view = opts.view ?? "active";
  return sql<Issue[]>`
    select ${issueColumns()}
    from issues s
    ${issueJoins()}
    where s.bank_id = ${bankId}
      ${view === "active" ? sql`and s.status <> 'RESOLVED' and s.total_complaints > 0` : sql``}
      ${view === "resolved" ? sql`and s.status = 'RESOLVED'` : sql``}
      ${opts.trend ? sql`and s.trend_status = ${opts.trend}` : sql``}
      ${opts.risk ? sql`and s.risk_level = ${opts.risk}` : sql``}
    order by s.risk_score desc, s.current_period_count desc`;
}

export async function getIssue(bankId: string, issueId: string): Promise<Issue | null> {
  const rows = await sql<Issue[]>`
    select ${issueColumns()}
    from issues s
    ${issueJoins()}
    where s.bank_id = ${bankId} and s.id = ${issueId}`;
  return rows[0] ?? null;
}

const analysisColumns = () => sql`
  a.id, a.issue_id, a.method, a.model, a.observed_pattern, a.likely_root_cause, a.root_cause_status,
  a.root_cause_confidence, a.alternative_causes, a.affected_systems, a.recommended_investigation,
  a.management_insight, a.ownership_status, a.primary_department_id, d.name as primary_department_name,
  a.primary_team_id, t.name as primary_team_name, a.primary_team_confidence, a.secondary_teams,
  a.ownership_reason, a.recommended_action, a.validation_notes, a.created_at`;

export async function listAnalyses(bankId: string, issueId: string): Promise<IssueAnalysis[]> {
  return sql<IssueAnalysis[]>`
    select ${analysisColumns()}
    from issue_analyses a
    left join teams t on t.id = a.primary_team_id and t.bank_id = a.bank_id
    left join departments d on d.id = a.primary_department_id and d.bank_id = a.bank_id
    where a.bank_id = ${bankId} and a.issue_id = ${issueId}
    order by a.created_at desc
    limit 20`;
}

export async function getAnalysis(bankId: string, analysisId: string): Promise<IssueAnalysis | null> {
  const rows = await sql<IssueAnalysis[]>`
    select ${analysisColumns()}
    from issue_analyses a
    left join teams t on t.id = a.primary_team_id and t.bank_id = a.bank_id
    left join departments d on d.id = a.primary_department_id and d.bank_id = a.bank_id
    where a.bank_id = ${bankId} and a.id = ${analysisId}`;
  return rows[0] ?? null;
}

export async function listNotes(bankId: string, issueId: string): Promise<IssueNote[]> {
  return sql<IssueNote[]>`
    select id, author, note, created_at from issue_notes
    where bank_id = ${bankId} and issue_id = ${issueId}
    order by created_at desc`;
}

export interface CustomerSignal {
  id: string;
  message: string;
  channel: string;
  location: string | null;
  branch: string | null;
  occurred_at: Date;
  issue: string;
  severity: string;
  sentiment: string;
}

/**
 * Representative complaints for an issue: most recent first, spread across
 * the specific issue labels so different phrasings are represented.
 */
export async function getCustomerSignals(bankId: string, issueCode: string, limit = 12): Promise<CustomerSignal[]> {
  return sql<CustomerSignal[]>`
    select id, message, channel, location, branch, occurred_at, issue, severity, sentiment from (
      select i.id, i.message, i.channel, coalesce(c.location, i.location) as location, i.branch, i.occurred_at,
             c.issue, c.severity, c.sentiment,
             row_number() over (partition by c.issue order by i.occurred_at desc) as rn
      from interaction_classifications c
      join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
      where c.bank_id = ${bankId} and c.issue_group = ${issueCode} and c.intent = 'COMPLAINT'
    ) ranked
    order by rn, occurred_at desc
    limit ${limit}`;
}

export async function getSpecificIssueLabels(bankId: string, issueCode: string) {
  return sql<{ name: string; count: number }[]>`
    select c.issue as name, count(*)::int as count
    from interaction_classifications c
    where c.bank_id = ${bankId} and c.issue_group = ${issueCode} and c.intent = 'COMPLAINT'
    group by c.issue
    order by count desc
    limit 10`;
}

export async function getIssueWeeklyTrend(bankId: string, issueCode: string, anchor: Date, weeks = 8) {
  const rows = await sql<{ weeks_ago: number; count: number }[]>`
    select floor(extract(epoch from (${anchor}::timestamptz - i.occurred_at)) / 604800)::int as weeks_ago,
           count(*)::int as count
    from interaction_classifications c
    join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
    where c.bank_id = ${bankId} and c.issue_group = ${issueCode} and c.intent = 'COMPLAINT'
      and i.occurred_at > ${anchor}::timestamptz - make_interval(days => ${weeks * 7})
    group by 1`;
  const byWeek = new Map(rows.map((r) => [r.weeks_ago, r.count]));
  return Array.from({ length: weeks }, (_, idx) => {
    const weeksAgo = weeks - 1 - idx;
    const end = new Date(anchor.getTime() - weeksAgo * 7 * 86_400_000);
    return { week: end, count: byWeek.get(weeksAgo) ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function assignIssue(
  bankId: string,
  issueId: string,
  teamId: string,
  source: "AI_ACCEPTED" | "MANUAL_OVERRIDE",
): Promise<boolean> {
  // Composite FK (bank_id, assigned_team_id) guarantees the team belongs to this bank.
  const rows = await sql`
    update issues set
      assigned_team_id = ${teamId}, assigned_at = now(), assignment_source = ${source},
      status = case when status = 'OPEN' then 'ASSIGNED' else status end,
      resolved_at = null,
      updated_at = now()
    where bank_id = ${bankId} and id = ${issueId}
    returning id`;
  return rows.length > 0;
}

export async function setIssueStatus(bankId: string, issueId: string, status: IssueStatus): Promise<boolean> {
  const rows = await sql`
    update issues set
      status = ${status},
      resolved_at = ${status === "RESOLVED" ? sql`now()` : null},
      updated_at = now()
    where bank_id = ${bankId} and id = ${issueId}
    returning id`;
  return rows.length > 0;
}

export async function addNote(bankId: string, issueId: string, author: string, note: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into issue_notes (bank_id, issue_id, author, note)
    values (${bankId}, ${issueId}, ${author}, ${note})
    returning id`;
  return row!;
}
