import "server-only";
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  PRODUCT_LABELS,
  humanize,
  type Category,
  type Channel,
  type ProductCode,
} from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { getAnalysisAnchor } from "@/lib/clustering/aggregate";
import { env } from "@/lib/env";

export interface Kpis {
  totalInteractions: number;
  totalComplaints: number;
  pending: number;
  classified: number;
  aiClassified: number;
  emergingIssues: number;
  criticalIssues: number;
  requiringInvestigation: number;
  currentPeriodComplaints: number;
  previousPeriodComplaints: number;
  periodDays: number;
  periodEnd: Date | null;
}

export async function getKpis(bankId: string): Promise<Kpis> {
  const periodDays = env().ANALYSIS_PERIOD_DAYS;
  const anchor = await getAnalysisAnchor(bankId);
  const curStart = anchor ? new Date(anchor.getTime() - periodDays * 86_400_000) : null;
  const prevStart = anchor ? new Date(anchor.getTime() - 2 * periodDays * 86_400_000) : null;

  const [interactions] = await sql<
    { total: number; pending: number; classified: number; ai: number; complaints: number; cur: number; prev: number }[]
  >`
    select count(*)::int as total,
      count(*) filter (where i.status = 'PENDING')::int as pending,
      count(*) filter (where i.status = 'CLASSIFIED')::int as classified,
      count(*) filter (where c.method = 'AI')::int as ai,
      count(*) filter (where c.intent = 'COMPLAINT')::int as complaints,
      count(*) filter (where c.intent = 'COMPLAINT' and i.occurred_at > ${curStart})::int as cur,
      count(*) filter (where c.intent = 'COMPLAINT' and i.occurred_at > ${prevStart} and i.occurred_at <= ${curStart})::int as prev
    from interactions i
    left join interaction_classifications c on c.interaction_id = i.id and c.bank_id = i.bank_id
    where i.bank_id = ${bankId}`;

  const [issues] = await sql<{ emerging: number; critical: number; investigate: number }[]>`
    select
      count(*) filter (where ${sqlSignificant()} and s.status <> 'RESOLVED')::int as emerging,
      count(*) filter (where s.risk_level = 'CRITICAL' and s.status <> 'RESOLVED')::int as critical,
      count(*) filter (where (${sqlSignificant()} or s.risk_level in ('HIGH', 'CRITICAL'))
                         and s.status in ('OPEN', 'ASSIGNED'))::int as investigate
    from issues s
    where s.bank_id = ${bankId} and s.total_complaints > 0`;

  return {
    totalInteractions: interactions?.total ?? 0,
    totalComplaints: interactions?.complaints ?? 0,
    pending: interactions?.pending ?? 0,
    classified: interactions?.classified ?? 0,
    aiClassified: interactions?.ai ?? 0,
    emergingIssues: issues?.emerging ?? 0,
    criticalIssues: issues?.critical ?? 0,
    requiringInvestigation: issues?.investigate ?? 0,
    currentPeriodComplaints: interactions?.cur ?? 0,
    previousPeriodComplaints: interactions?.prev ?? 0,
    periodDays,
    periodEnd: anchor,
  };
}

function sqlSignificant() {
  return sql`s.trend_status in ('EMERGING', 'HIGH_CONCERN', 'CRITICAL')`;
}

/** Weekly complaint counts for the top issue groups (by current-period volume). */
export async function getTrendSeries(bankId: string, weeks = 8, topN = 5) {
  const anchor = await getAnalysisAnchor(bankId);
  if (!anchor)
    return {
      weeks: [] as { label: string; end: Date }[],
      series: [] as string[],
      rows: [] as Record<string, number | string>[],
    };

  const top = await sql<{ issue_code: string; title: string }[]>`
    select issue_code, title from issues
    where bank_id = ${bankId} and total_complaints > 0
    order by current_period_count desc, risk_score desc
    limit ${topN}`;
  const codes = top.map((t) => t.issue_code);

  const counts = await sql<{ issue_group: string; weeks_ago: number; count: number }[]>`
    select c.issue_group,
      floor(extract(epoch from (${anchor}::timestamptz - i.occurred_at)) / 604800)::int as weeks_ago,
      count(*)::int as count
    from interaction_classifications c
    join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
    where c.bank_id = ${bankId} and c.intent = 'COMPLAINT'
      and i.occurred_at > ${anchor}::timestamptz - make_interval(days => ${weeks * 7})
    group by 1, 2`;

  const titleOf = new Map(top.map((t) => [t.issue_code, t.title]));
  const rows = Array.from({ length: weeks }, (_, idx) => {
    const weeksAgo = weeks - 1 - idx;
    const end = new Date(anchor.getTime() - weeksAgo * 7 * 86_400_000);
    const row: Record<string, number | string> = {
      label: weeksAgo === 0 ? "This week" : end.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      Total: 0,
    };
    for (const code of codes) row[titleOf.get(code)!] = 0;
    row["Other"] = 0;
    for (const c of counts.filter((x) => x.weeks_ago === weeksAgo)) {
      const key = titleOf.get(c.issue_group) ?? "Other";
      row[key] = (row[key] as number) + c.count;
      row.Total = (row.Total as number) + c.count;
    }
    return row;
  });

  return {
    weeks: rows.map((r) => ({ label: String(r.label), end: anchor })),
    series: [...codes.map((c) => titleOf.get(c)!), "Other"],
    rows,
  };
}

export interface OwnerCount {
  name: string;
  department: string | null;
  issues: number;
  significant: number;
  critical: number;
  complaints: number;
}

/** Active issues per owning team: assigned team, else latest AI recommendation. */
export async function getIssuesByOwner(bankId: string): Promise<OwnerCount[]> {
  return sql<OwnerCount[]>`
    with owners as (
      select s.id, s.risk_level, s.trend_status, s.current_period_count,
             coalesce(s.assigned_team_id, a.primary_team_id) as team_id
      from issues s
      left join lateral (
        select x.primary_team_id from issue_analyses x
        where x.issue_id = s.id and x.bank_id = s.bank_id
        order by x.created_at desc limit 1
      ) a on true
      where s.bank_id = ${bankId} and s.status <> 'RESOLVED' and s.total_complaints > 0
    )
    select coalesce(t.name, 'Unassigned / not yet analysed') as name, d.name as department,
           count(*)::int as issues,
           count(*) filter (where o.trend_status in ('EMERGING', 'HIGH_CONCERN', 'CRITICAL'))::int as significant,
           count(*) filter (where o.risk_level = 'CRITICAL')::int as critical,
           coalesce(sum(o.current_period_count), 0)::int as complaints
    from owners o
    left join teams t on t.id = o.team_id and t.bank_id = ${bankId}
    left join departments d on d.id = t.department_id and d.bank_id = ${bankId}
    group by 1, 2
    order by significant desc, issues desc`;
}

export interface TeamImpactRow {
  team_id: string;
  team_name: string;
  department_id: string;
  department_name: string;
  owned_issues: number;
  emerging_issues: number;
  critical_issues: number;
  supporting_issues: number;
  current_complaints: number;
  issues: {
    id: string;
    title: string;
    trend_status: string;
    risk_level: string;
    role: "PRIMARY" | "SECONDARY";
    assigned: boolean;
  }[];
}

/** Team Impact: where operational problems are accumulating. */
export async function getTeamImpact(bankId: string): Promise<TeamImpactRow[]> {
  const rows = await sql<
    {
      team_id: string;
      team_name: string;
      department_id: string;
      department_name: string;
      issue_id: string | null;
      title: string | null;
      trend_status: string | null;
      risk_level: string | null;
      current_period_count: number | null;
      role: "PRIMARY" | "SECONDARY" | null;
      assigned: boolean | null;
    }[]
  >`
    with latest as (
      select distinct on (x.issue_id) x.issue_id, x.primary_team_id, x.secondary_teams
      from issue_analyses x
      where x.bank_id = ${bankId}
      order by x.issue_id, x.created_at desc
    ),
    links as (
      select s.id as issue_id, coalesce(s.assigned_team_id, l.primary_team_id) as team_id, 'PRIMARY' as role,
             (s.assigned_team_id is not null) as assigned
      from issues s left join latest l on l.issue_id = s.id
      where s.bank_id = ${bankId} and s.status <> 'RESOLVED' and s.total_complaints > 0
      union all
      select s.id, (st.value ->> 'team_id')::uuid, 'SECONDARY', false
      from issues s
      join latest l on l.issue_id = s.id
      cross join lateral jsonb_array_elements(l.secondary_teams) st(value)
      where s.bank_id = ${bankId} and s.status <> 'RESOLVED' and s.total_complaints > 0
        and s.assigned_team_id is null
    )
    select t.id as team_id, t.name as team_name, d.id as department_id, d.name as department_name,
           s.id as issue_id, s.title, s.trend_status, s.risk_level, s.current_period_count, k.role, k.assigned
    from teams t
    join departments d on d.id = t.department_id and d.bank_id = t.bank_id
    left join links k on k.team_id = t.id
    left join issues s on s.id = k.issue_id and s.bank_id = t.bank_id
    where t.bank_id = ${bankId}
    order by d.name, t.name, s.risk_score desc nulls last`;

  const byTeam = new Map<string, TeamImpactRow>();
  for (const r of rows) {
    let team = byTeam.get(r.team_id);
    if (!team) {
      team = {
        team_id: r.team_id,
        team_name: r.team_name,
        department_id: r.department_id,
        department_name: r.department_name,
        owned_issues: 0,
        emerging_issues: 0,
        critical_issues: 0,
        supporting_issues: 0,
        current_complaints: 0,
        issues: [],
      };
      byTeam.set(r.team_id, team);
    }
    if (!r.issue_id || !r.role) continue;
    team.issues.push({
      id: r.issue_id,
      title: r.title ?? "",
      trend_status: r.trend_status ?? "STABLE",
      risk_level: r.risk_level ?? "LOW",
      role: r.role,
      assigned: Boolean(r.assigned),
    });
    if (r.role === "PRIMARY") {
      team.owned_issues++;
      team.current_complaints += r.current_period_count ?? 0;
      if (["EMERGING", "HIGH_CONCERN", "CRITICAL"].includes(r.trend_status ?? "")) team.emerging_issues++;
      if (r.risk_level === "CRITICAL") team.critical_issues++;
    } else {
      team.supporting_issues++;
    }
  }
  return [...byTeam.values()];
}

export interface CountItem {
  name: string;
  count: number;
  current: number;
}

export async function getTopBreakdowns(bankId: string) {
  const periodDays = env().ANALYSIS_PERIOD_DAYS;
  const anchor = await getAnalysisAnchor(bankId);
  const curStart = anchor ? new Date(anchor.getTime() - periodDays * 86_400_000) : new Date(0);

  const [categories, products, branches, channels] = await Promise.all([
    sql<CountItem[]>`
      select c.category as name, count(*)::int as count,
             count(*) filter (where i.occurred_at > ${curStart})::int as current
      from interaction_classifications c join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
      where c.bank_id = ${bankId} and c.intent = 'COMPLAINT'
      group by 1 order by count desc limit 8`,
    sql<CountItem[]>`
      select c.product as name, count(*)::int as count,
             count(*) filter (where i.occurred_at > ${curStart})::int as current
      from interaction_classifications c join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
      where c.bank_id = ${bankId} and c.intent = 'COMPLAINT'
      group by 1 order by count desc limit 8`,
    sql<CountItem[]>`
      select i.branch as name, count(*)::int as count,
             count(*) filter (where i.occurred_at > ${curStart})::int as current
      from interaction_classifications c join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
      where c.bank_id = ${bankId} and c.intent = 'COMPLAINT' and i.branch is not null
      group by 1 order by current desc, count desc limit 8`,
    sql<CountItem[]>`
      select i.channel as name, count(*)::int as count,
             count(*) filter (where i.occurred_at > ${curStart})::int as current
      from interaction_classifications c join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
      where c.bank_id = ${bankId} and c.intent = 'COMPLAINT'
      group by 1 order by count desc`,
  ]);

  return {
    categories: categories.map((c) => ({ ...c, name: CATEGORY_LABELS[c.name as Category] ?? humanize(c.name) })),
    products: products.map((p) => ({ ...p, name: PRODUCT_LABELS[p.name as ProductCode] ?? humanize(p.name) })),
    branches,
    channels: channels.map((c) => ({ ...c, name: CHANNEL_LABELS[c.name as Channel] ?? c.name })),
  };
}
