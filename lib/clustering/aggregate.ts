import "server-only";
import { CHANNEL_LABELS, PRODUCT_LABELS, issueTitle, type Channel, type ProductCode } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { env } from "@/lib/env";
import { averageSeverity, computeRisk, severityFromAverage } from "@/lib/scoring/risk";
import { growthPercent, trendStatus } from "@/lib/scoring/trend";
import type { BreakdownItem } from "@/types";

/**
 * Pattern detection: aggregates classified complaints per normalised issue
 * group and computes all metrics deterministically. The current period is
 * the `periodDays` window ending at the latest complaint timestamp, so demo
 * data stays meaningful regardless of when it was seeded.
 */

interface GroupStats {
  issue_group: string;
  category: string;
  total: number;
  cur: number;
  prev: number;
  low_c: number;
  med_c: number;
  high_c: number;
  crit_c: number;
  low_t: number;
  med_t: number;
  high_t: number;
  crit_t: number;
  neg_c: number;
  vneg_c: number;
  amount_c: number | null;
  first_seen: Date;
  last_seen: Date;
}

interface DimRow {
  issue_group: string;
  name: string;
  is_current: boolean;
  count: number;
}

const label = (dimension: "channel" | "product" | "other", name: string) =>
  dimension === "channel"
    ? (CHANNEL_LABELS[name as Channel] ?? name)
    : dimension === "product"
      ? (PRODUCT_LABELS[name as ProductCode] ?? name)
      : name;

export function toBreakdown(
  rows: DimRow[],
  group: string,
  useCurrent: boolean,
  dimension: "channel" | "product" | "other",
): BreakdownItem[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.issue_group !== group || (useCurrent && !r.is_current)) continue;
    counts.set(r.name, (counts.get(r.name) ?? 0) + r.count);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  return [...counts.entries()]
    .map(([name, count]) => ({
      name: label(dimension, name),
      count,
      pct: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getAnalysisAnchor(bankId: string): Promise<Date | null> {
  const [row] = await sql<{ anchor: Date | null }[]>`
    select max(i.occurred_at) as anchor
    from interactions i
    join interaction_classifications c on c.interaction_id = i.id and c.bank_id = i.bank_id
    where i.bank_id = ${bankId} and c.intent = 'COMPLAINT'`;
  return row?.anchor ?? null;
}

export async function recomputeIssues(
  bankId: string,
  opts: { audit?: boolean; actor?: string; currency?: string } = {},
): Promise<{ issues: number; anchor: Date | null }> {
  const periodDays = env().ANALYSIS_PERIOD_DAYS;
  const anchor = await getAnalysisAnchor(bankId);
  if (!anchor) return { issues: 0, anchor: null };

  const curStart = new Date(anchor.getTime() - periodDays * 86_400_000);
  const prevStart = new Date(anchor.getTime() - 2 * periodDays * 86_400_000);

  const base = () => sql`
    from interaction_classifications c
    join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
    where c.bank_id = ${bankId} and c.intent = 'COMPLAINT'`;

  const [stats, channels, products, locations, branches, totals] = await Promise.all([
    sql<GroupStats[]>`
      select c.issue_group,
        mode() within group (order by c.category) as category,
        count(*)::int as total,
        count(*) filter (where i.occurred_at > ${curStart})::int as cur,
        count(*) filter (where i.occurred_at > ${prevStart} and i.occurred_at <= ${curStart})::int as prev,
        count(*) filter (where i.occurred_at > ${curStart} and c.severity = 'LOW')::int as low_c,
        count(*) filter (where i.occurred_at > ${curStart} and c.severity = 'MEDIUM')::int as med_c,
        count(*) filter (where i.occurred_at > ${curStart} and c.severity = 'HIGH')::int as high_c,
        count(*) filter (where i.occurred_at > ${curStart} and c.severity = 'CRITICAL')::int as crit_c,
        count(*) filter (where c.severity = 'LOW')::int as low_t,
        count(*) filter (where c.severity = 'MEDIUM')::int as med_t,
        count(*) filter (where c.severity = 'HIGH')::int as high_t,
        count(*) filter (where c.severity = 'CRITICAL')::int as crit_t,
        count(*) filter (where i.occurred_at > ${curStart} and c.sentiment in ('NEGATIVE', 'VERY_NEGATIVE'))::int as neg_c,
        count(*) filter (where i.occurred_at > ${curStart} and c.sentiment = 'VERY_NEGATIVE')::int as vneg_c,
        sum(i.amount) filter (where i.occurred_at > ${curStart}) as amount_c,
        min(i.occurred_at) as first_seen,
        max(i.occurred_at) as last_seen
      ${base()}
      group by c.issue_group`,
    sql<DimRow[]>`
      select c.issue_group, i.channel as name, (i.occurred_at > ${curStart}) as is_current, count(*)::int as count
      ${base()} group by 1, 2, 3`,
    sql<DimRow[]>`
      select c.issue_group, c.product as name, (i.occurred_at > ${curStart}) as is_current, count(*)::int as count
      ${base()} group by 1, 2, 3`,
    sql<DimRow[]>`
      select c.issue_group, coalesce(c.location, i.location) as name, (i.occurred_at > ${curStart}) as is_current,
             count(*)::int as count
      ${base()} and coalesce(c.location, i.location) is not null group by 1, 2, 3`,
    sql<DimRow[]>`
      select c.issue_group, i.branch as name, (i.occurred_at > ${curStart}) as is_current, count(*)::int as count
      ${base()} and i.branch is not null group by 1, 2, 3`,
    sql<{ all_total: number; cur_total: number }[]>`
      select count(*)::int as all_total, count(*) filter (where i.occurred_at > ${curStart})::int as cur_total
      ${base()}`,
  ]);

  const allTotal = totals[0]?.all_total ?? 0;
  const curTotal = totals[0]?.cur_total ?? 0;
  const now = new Date();

  await sql.begin(async (tx) => {
    for (const s of stats) {
      const useCurrent = s.cur > 0;
      const channelBreakdown = toBreakdown(channels, s.issue_group, useCurrent, "channel");
      const productBreakdown = toBreakdown(products, s.issue_group, useCurrent, "product");
      const locationBreakdown = toBreakdown(locations, s.issue_group, useCurrent, "other");
      const branchBreakdown = toBreakdown(branches, s.issue_group, useCurrent, "other");

      const growth = growthPercent(s.cur, s.prev);
      const trend = trendStatus(s.cur, s.prev);
      const sevCurrent = { LOW: s.low_c, MEDIUM: s.med_c, HIGH: s.high_c, CRITICAL: s.crit_c };
      const sevAll = { LOW: s.low_t, MEDIUM: s.med_t, HIGH: s.high_t, CRITICAL: s.crit_t };
      const severity = severityFromAverage(averageSeverity(useCurrent ? sevCurrent : sevAll));
      const risk = computeRisk({
        currentCount: s.cur,
        totalCurrentComplaints: curTotal,
        trend,
        growthPct: growth,
        severityCounts: sevCurrent,
        negativeCount: s.neg_c,
        veryNegativeCount: s.vneg_c,
        channelCount: useCurrent ? channelBreakdown.length : 0,
        locationCount: useCurrent ? locationBreakdown.length : 0,
        financialImpact: s.amount_c,
        currency: opts.currency,
      });
      const pctOfTotal = allTotal === 0 ? 0 : Math.round((s.total / allTotal) * 10000) / 100;

      await tx`
        insert into issues (
          bank_id, issue_code, title, category, trend_status, risk_level, risk_score, risk_factors,
          total_complaints, pct_of_total, current_period_count, previous_period_count, growth_pct, severity,
          channel_breakdown, product_breakdown, location_breakdown, branch_breakdown, financial_impact,
          period_days, period_end, first_seen_at, last_seen_at, metrics_updated_at, updated_at
        ) values (
          ${bankId}, ${s.issue_group}, ${issueTitle(s.issue_group)}, ${s.category}, ${trend}, ${risk.level},
          ${risk.score}, ${tx.json(risk.factors as never)}, ${s.total}, ${pctOfTotal}, ${s.cur}, ${s.prev},
          ${growth}, ${severity}, ${tx.json(channelBreakdown as never)}, ${tx.json(productBreakdown as never)},
          ${tx.json(locationBreakdown as never)}, ${tx.json(branchBreakdown as never)}, ${s.amount_c},
          ${periodDays}, ${anchor}, ${s.first_seen}, ${s.last_seen}, ${now}, ${now}
        )
        on conflict (bank_id, issue_code) do update set
          category = excluded.category,
          trend_status = excluded.trend_status,
          risk_level = excluded.risk_level,
          risk_score = excluded.risk_score,
          risk_factors = excluded.risk_factors,
          total_complaints = excluded.total_complaints,
          pct_of_total = excluded.pct_of_total,
          current_period_count = excluded.current_period_count,
          previous_period_count = excluded.previous_period_count,
          growth_pct = excluded.growth_pct,
          severity = excluded.severity,
          channel_breakdown = excluded.channel_breakdown,
          product_breakdown = excluded.product_breakdown,
          location_breakdown = excluded.location_breakdown,
          branch_breakdown = excluded.branch_breakdown,
          financial_impact = excluded.financial_impact,
          period_days = excluded.period_days,
          period_end = excluded.period_end,
          first_seen_at = excluded.first_seen_at,
          last_seen_at = excluded.last_seen_at,
          metrics_updated_at = excluded.metrics_updated_at,
          updated_at = excluded.updated_at`;
    }

    // Issue groups that no longer have complaints (e.g. after re-classification).
    const codes = stats.map((s) => s.issue_group);
    await tx`
      update issues set total_complaints = 0, current_period_count = 0, previous_period_count = 0,
        growth_pct = null, pct_of_total = 0, trend_status = 'STABLE', risk_level = 'LOW', risk_score = 0,
        metrics_updated_at = ${now}, updated_at = ${now}
      where bank_id = ${bankId} and not (issue_code = any(${codes}))`;
  });

  if (opts.audit) {
    await writeAudit({
      bankId,
      eventType: "ISSUES_RECOMPUTED",
      actor: opts.actor ?? "SYSTEM",
      details: { issue_groups: stats.length, complaints: allTotal, period_days: periodDays, period_end: anchor },
    });
  }

  return { issues: stats.length, anchor };
}
