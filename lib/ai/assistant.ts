import "server-only";
import { TREND_LABELS, humanize } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { getKpis, getTeamImpact, getTopBreakdowns } from "@/lib/db/dashboard";
import { listIssues } from "@/lib/db/issues";
import { aiConfigured } from "@/lib/env";
import { AIAssistantAnswerSchema, type AssistantAnswer } from "@/lib/validation/ai";
import { MANAGEMENT_ASSISTANT_SYSTEM_PROMPT, managementAssistantUserPrompt } from "@/prompts/management-insight";
import type { Bank } from "@/types";
import { AIUnavailableError, structuredCompletion } from "./claude";

export interface AssistantResponse extends AssistantAnswer {
  method: "AI" | "RULES";
  model: string | null;
  referenced_issues: { id: string; issue_code: string; title: string }[];
  note: string | null;
}

/** Builds the grounded data snapshot (all figures computed by the application). */
export async function buildSnapshot(bank: Bank) {
  const [kpis, issues, impact, breakdowns, analyses] = await Promise.all([
    getKpis(bank.id),
    listIssues(bank.id, { view: "active" }),
    getTeamImpact(bank.id),
    getTopBreakdowns(bank.id),
    sql<
      {
        issue_id: string;
        likely_root_cause: string;
        root_cause_status: string;
        root_cause_confidence: number;
        recommended_action: string;
      }[]
    >`
      select distinct on (issue_id) issue_id, likely_root_cause, root_cause_status, root_cause_confidence, recommended_action
      from issue_analyses where bank_id = ${bank.id}
      order by issue_id, created_at desc`,
  ]);
  const analysisByIssue = new Map(analyses.map((a) => [a.issue_id, a]));
  const top = issues.slice(0, 15);

  return {
    bank: bank.name,
    period: {
      period_days: kpis.periodDays,
      period_end: kpis.periodEnd?.toISOString().slice(0, 10) ?? null,
      current_period_complaints: kpis.currentPeriodComplaints,
      previous_period_complaints: kpis.previousPeriodComplaints,
    },
    totals: {
      total_interactions: kpis.totalInteractions,
      total_complaints: kpis.totalComplaints,
      unclassified_interactions: kpis.pending,
      emerging_issues: kpis.emergingIssues,
      critical_risk_issues: kpis.criticalIssues,
      issues_requiring_investigation: kpis.requiringInvestigation,
    },
    issues_ranked_by_risk: top.map((i) => {
      const a = analysisByIssue.get(i.id);
      return {
        issue_code: i.issue_code,
        title: i.title,
        status: i.status,
        trend: TREND_LABELS[i.trend_status],
        growth_pct: i.growth_pct,
        current_period_complaints: i.current_period_count,
        previous_period_complaints: i.previous_period_count,
        total_complaints: i.total_complaints,
        pct_of_all_complaints: i.pct_of_total,
        risk_level: i.risk_level,
        risk_score: i.risk_score,
        severity: i.severity,
        top_channels: i.channel_breakdown.slice(0, 3).map((c) => `${c.name} ${c.pct}%`),
        top_products: i.product_breakdown.slice(0, 2).map((c) => `${c.name} ${c.pct}%`),
        top_locations: i.location_breakdown.slice(0, 3).map((c) => `${c.name} ${c.pct}%`),
        top_branches: i.branch_breakdown.slice(0, 3).map((c) => `${c.name} ${c.pct}%`),
        likely_root_cause: a ? `${humanize(a.root_cause_status)}: ${a.likely_root_cause}` : "Not yet analysed",
        root_cause_confidence_pct: a ? Math.round(a.root_cause_confidence * 100) : null,
        recommended_action: a?.recommended_action ?? null,
        recommended_team: i.recommended_team_name,
        recommended_department: i.recommended_department_name,
        ownership_status: i.ownership_status,
        assigned_team: i.assigned_team_name,
      };
    }),
    issues_ranked_by_growth: [...issues]
      .filter((i) => i.growth_pct !== null)
      .sort((a, b) => (b.growth_pct ?? 0) - (a.growth_pct ?? 0))
      .slice(0, 8)
      .map((i) => ({
        issue_code: i.issue_code,
        title: i.title,
        growth_pct: i.growth_pct,
        trend: TREND_LABELS[i.trend_status],
      })),
    team_impact: impact
      .filter((t) => t.owned_issues + t.supporting_issues > 0)
      .map((t) => ({
        team: t.team_name,
        department: t.department_name,
        owned_issues: t.owned_issues,
        emerging_issues: t.emerging_issues,
        critical_risk_issues: t.critical_issues,
        supporting_issues: t.supporting_issues,
      })),
    complaints_by_product: breakdowns.products.map((p) => ({
      product: p.name,
      total: p.count,
      current_period: p.current,
    })),
    complaints_by_branch: breakdowns.branches.map((b) => ({
      branch: b.name,
      total: b.count,
      current_period: b.current,
    })),
    complaints_by_category: breakdowns.categories.map((c) => ({
      category: c.name,
      total: c.count,
      current_period: c.current,
    })),
    complaints_by_channel: breakdowns.channels.map((c) => ({
      channel: c.name,
      total: c.count,
      current_period: c.current,
    })),
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

/** Deterministic answers for common management questions (AI fallback). */
export function answerWithRules(question: string, s: Snapshot): AssistantAnswer {
  const q = question.toLowerCase();
  const top = s.issues_ranked_by_risk;
  const biggest = [...top].sort((a, b) => b.current_period_complaints - a.current_period_complaints)[0];

  if (top.length === 0) {
    return {
      answer:
        "There are no analysed issues yet. Classify the pending interactions first so ServicePulse can detect issues.",
      key_points: [`${s.totals.unclassified_interactions} interactions are awaiting classification.`],
      referenced_issue_codes: [],
      data_limitations: "No classified complaints are available.",
    };
  }

  if (/team|who|owner|responsib|handle/.test(q)) {
    const t = top[0]!;
    return {
      answer: t.recommended_team
        ? `${t.recommended_team} (${t.recommended_department}) is the recommended owner of the highest-risk issue, ${t.title}.`
        : `The highest-risk issue, ${t.title}, has no recommended owner yet — run the AI analysis or assign it manually.`,
      key_points: [
        `${t.title}: risk ${t.risk_level} (${t.risk_score}/100), ${t.current_period_complaints} complaints this period.`,
        `Likely root cause: ${t.likely_root_cause}.`,
        ...(t.assigned_team ? [`Currently assigned to ${t.assigned_team}.`] : []),
        ...s.team_impact
          .slice(0, 3)
          .map((x) => `${x.team}: ${x.owned_issues} owned issue(s), ${x.emerging_issues} emerging.`),
      ],
      referenced_issue_codes: [t.issue_code],
      data_limitations: null,
    };
  }
  if (/fast|increas|grow|rising|trend/.test(q)) {
    const g = s.issues_ranked_by_growth.slice(0, 3);
    return {
      answer: g[0]
        ? `${g[0].title} is increasing fastest (${g[0].growth_pct}% vs the previous period, ${g[0].trend}).`
        : "No issue has a previous-period baseline to measure growth against.",
      key_points: g.map((x) => `${x.title}: ${x.growth_pct}% (${x.trend}).`),
      referenced_issue_codes: g.map((x) => x.issue_code),
      data_limitations: null,
    };
  }
  if (/product/.test(q)) {
    const p = s.complaints_by_product.slice(0, 4);
    return {
      answer: p[0]
        ? `${p[0].product} generates the most complaints (${p[0].total} in total, ${p[0].current_period} this period).`
        : "No product data available.",
      key_points: p.map((x) => `${x.product}: ${x.total} complaints (${x.current_period} this period).`),
      referenced_issue_codes: [],
      data_limitations: null,
    };
  }
  if (/branch|location|where/.test(q)) {
    const b = s.complaints_by_branch.slice(0, 4);
    return {
      answer: b[0]
        ? `${b[0].branch} is the most affected branch this period (${b[0].current_period} complaints, ${b[0].total} in total).`
        : "No branch data available.",
      key_points: b.map((x) => `${x.branch}: ${x.current_period} complaints this period (${x.total} total).`),
      referenced_issue_codes: [],
      data_limitations: "Only complaints linked to a branch are included.",
    };
  }
  if (/priorit|focus|today|urgent|action/.test(q)) {
    const p = top.filter((i) => i.risk_level === "CRITICAL" || i.risk_level === "HIGH").slice(0, 3);
    const list = p.length ? p : top.slice(0, 3);
    return {
      answer: `Management should prioritise ${list.map((i) => i.title).join(", ")}.`,
      key_points: list.map(
        (i) =>
          `${i.title}: ${i.risk_level} risk (${i.risk_score}/100), ${i.trend}${i.growth_pct !== null ? ` (${i.growth_pct}%)` : ""}; owner: ${i.assigned_team ?? i.recommended_team ?? "not yet determined"}.`,
      ),
      referenced_issue_codes: list.map((i) => i.issue_code),
      data_limitations: null,
    };
  }
  const b = biggest!;
  return {
    answer: `The biggest customer problem this period is ${b.title}, with ${b.current_period_complaints} complaints (${b.trend}${b.growth_pct !== null ? `, ${b.growth_pct}% vs previous period` : ""}).`,
    key_points: [
      `Risk: ${b.risk_level} (${b.risk_score}/100).`,
      `Main channels: ${b.top_channels.join(", ")}.`,
      `Likely root cause: ${b.likely_root_cause}.`,
      `Recommended owner: ${b.recommended_team ?? "not yet determined"}.`,
    ],
    referenced_issue_codes: [b.issue_code],
    data_limitations: null,
  };
}

export async function askServicePulse(bank: Bank, question: string): Promise<AssistantResponse> {
  const snapshot = await buildSnapshot(bank);
  const issues = await listIssues(bank.id, { view: "all" });
  const issueByCode = new Map(issues.map((i) => [i.issue_code, i]));

  let answer: AssistantAnswer;
  let method: "AI" | "RULES" = "RULES";
  let model: string | null = null;
  let note: string | null = null;

  if (aiConfigured()) {
    try {
      const res = await structuredCompletion({
        schema: AIAssistantAnswerSchema,
        name: "management_answer",
        tier: "deep",
        system: MANAGEMENT_ASSISTANT_SYSTEM_PROMPT,
        user: managementAssistantUserPrompt(question, snapshot),
      });
      answer = res.data;
      method = "AI";
      model = res.model;
    } catch (err) {
      note = `${err instanceof AIUnavailableError ? err.message : "AI unavailable"} — showing a deterministic answer.`;
      answer = answerWithRules(question, snapshot);
    }
  } else {
    note = "AI is not configured — showing a deterministic answer computed from the same data.";
    answer = answerWithRules(question, snapshot);
  }

  // Only keep references to issues that really exist for this bank.
  const referenced = answer.referenced_issue_codes
    .map((c) => issueByCode.get(c))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  return {
    ...answer,
    key_points: answer.key_points.slice(0, 6),
    referenced_issue_codes: referenced.map((i) => i.issue_code),
    referenced_issues: referenced.map((i) => ({ id: i.id, issue_code: i.issue_code, title: i.title })),
    method,
    model,
    note,
  };
}
