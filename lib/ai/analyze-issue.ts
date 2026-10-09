import "server-only";
import { PRODUCT_LABELS, type ProductCode } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { getDirectoryForPrompt, listSystems, listTeams } from "@/lib/db/directory";
import { getCustomerSignals, getIssue, getSpecificIssueLabels, listIssues } from "@/lib/db/issues";
import { aiConfigured } from "@/lib/env";
import { SIGNIFICANT_TRENDS } from "@/lib/scoring/trend";
import { forAI } from "@/lib/utils/sanitize";
import {
  AIRootCauseSchema,
  AITeamRecommendationSchema,
  ValidatedRootCauseSchema,
  ValidatedTeamRecommendationSchema,
  type RootCauseResult,
} from "@/lib/validation/ai";
import { ROOT_CAUSE_SYSTEM_PROMPT, rootCauseUserPrompt, type IssueEvidence } from "@/prompts/root-cause-analysis";
import { TEAM_RECOMMENDATION_SYSTEM_PROMPT, teamRecommendationUserPrompt } from "@/prompts/team-recommendation";
import type { Bank } from "@/types";
import { AIUnavailableError, structuredCompletion } from "./claude";
import { recommendedActionFor, rootCauseWithRules } from "./rules/root-cause";
import { recommendTeamWithRules } from "./rules/team-matcher";
import { validateTeamRecommendation, type DirectoryEntry, type ValidatedOwnership } from "./team-validation";

const LABEL_TO_PRODUCT = new Map(
  (Object.entries(PRODUCT_LABELS) as [ProductCode, string][]).map(([code, label]) => [label, code]),
);

export interface AnalysisOutcome {
  analysisId: string;
  method: "AI" | "RULES";
  ownershipStatus: ValidatedOwnership["status"];
}

export class IssueNotFoundError extends Error {}

export async function analyzeIssue(bank: Bank, issueId: string, actor: string): Promise<AnalysisOutcome> {
  const issue = await getIssue(bank.id, issueId);
  if (!issue) throw new IssueNotFoundError("Issue not found");

  const [signals, labels, systems, directory, teams] = await Promise.all([
    getCustomerSignals(bank.id, issue.issue_code, 12),
    getSpecificIssueLabels(bank.id, issue.issue_code),
    listSystems(bank.id),
    getDirectoryForPrompt(bank.id),
    listTeams(bank.id),
  ]);

  const evidence: IssueEvidence = {
    issue_code: issue.issue_code,
    issue_title: issue.title,
    category: issue.category,
    period_days: issue.period_days,
    metrics: {
      total_complaints: issue.total_complaints,
      pct_of_all_complaints: issue.pct_of_total,
      current_period_complaints: issue.current_period_count,
      previous_period_complaints: issue.previous_period_count,
      growth_pct: issue.growth_pct,
      trend_status: issue.trend_status,
      risk_level: issue.risk_level,
      risk_score: issue.risk_score,
      dominant_severity: issue.severity,
      financial_impact_current_period: issue.financial_impact,
      currency: bank.currency,
    },
    affected_channels: issue.channel_breakdown.slice(0, 8),
    affected_products: issue.product_breakdown.slice(0, 6),
    affected_locations: issue.location_breakdown.slice(0, 6),
    affected_branches: issue.branch_breakdown.slice(0, 6),
    specific_issue_labels: labels,
    sample_customer_messages: signals.map((s) => ({ channel: s.channel, message: forAI(s.message, 300) })),
    known_systems: systems,
  };

  const useAI = aiConfigured();
  const notes: string[] = [];
  let model: string | null = null;

  // ---- 1. Root-cause analysis -------------------------------------------
  let rootCause: RootCauseResult;
  let rcaMethod: "AI" | "RULES" = "RULES";
  if (useAI) {
    try {
      const res = await structuredCompletion({
        schema: AIRootCauseSchema,
        name: "root_cause_analysis",
        tier: "deep",
        system: ROOT_CAUSE_SYSTEM_PROMPT,
        user: rootCauseUserPrompt(evidence),
      });
      const parsed = ValidatedRootCauseSchema.safeParse(res.data);
      if (parsed.success) {
        rootCause = parsed.data;
        rcaMethod = "AI";
        model = res.model;
      } else {
        notes.push("AI root-cause output failed validation; rules-based hypothesis used.");
        rootCause = rootCauseWithRules(evidence);
      }
    } catch (err) {
      notes.push(
        `${err instanceof AIUnavailableError ? err.message : "AI unavailable"}; rules-based root-cause hypothesis used.`,
      );
      rootCause = rootCauseWithRules(evidence);
    }
  } else {
    notes.push("AI not configured; rules-based root-cause hypothesis used.");
    rootCause = rootCauseWithRules(evidence);
  }

  // ---- 2. Responsible-team recommendation -------------------------------
  const deptIdByTeam = new Map(teams.map((t) => [t.id, t.department_id]));
  const entries: DirectoryEntry[] = directory.map((d) => ({
    team_id: d.team_id,
    team_name: d.team_name,
    department: d.department,
    department_id: deptIdByTeam.get(d.team_id) ?? "",
  }));
  const topProducts = issue.product_breakdown.slice(0, 3).map((p) => LABEL_TO_PRODUCT.get(p.name) ?? p.name);

  let ownership: ValidatedOwnership;
  let reason = "";
  let action = recommendedActionFor(issue.issue_code);
  let teamMethod: "AI" | "RULES" = "RULES";

  if (directory.length === 0) {
    ownership = {
      status: "NO_CLEAR_OWNER",
      primary: null,
      secondary: [],
      notes: ["The bank's team directory is empty."],
    };
    reason = "No teams are defined in the responsibility directory.";
    action = "Manual assignment required.";
  } else {
    let aiDone = false;
    if (useAI) {
      try {
        const res = await structuredCompletion({
          schema: AITeamRecommendationSchema,
          name: "team_recommendation",
          tier: "deep",
          system: TEAM_RECOMMENDATION_SYSTEM_PROMPT,
          user: teamRecommendationUserPrompt(
            {
              issue_code: issue.issue_code,
              issue_title: issue.title,
              likely_root_cause: rootCause.root_cause.description,
              root_cause_status: rootCause.root_cause.status,
              affected_systems: rootCause.affected_systems,
              top_products: topProducts,
              top_channels: issue.channel_breakdown.slice(0, 3).map((c) => c.name),
              sample_customer_messages: signals.slice(0, 5).map((s) => forAI(s.message, 200)),
            },
            directory,
          ),
        });
        model ??= res.model;
        teamMethod = "AI";
        aiDone = true;
        const parsed = ValidatedTeamRecommendationSchema.safeParse(res.data);
        if (!parsed.success) {
          ownership = {
            status: "REJECTED_INVALID_TEAM",
            primary: null,
            secondary: [],
            notes: ["AI team recommendation failed schema validation — manual assignment required."],
          };
        } else {
          ownership = validateTeamRecommendation(parsed.data, entries);
          reason = parsed.data.reason;
          action = parsed.data.recommended_action || action;
        }
      } catch (err) {
        notes.push(
          `${err instanceof AIUnavailableError ? err.message : "AI unavailable"}; rules-based team matching used.`,
        );
      }
    }
    if (!aiDone) {
      const rec = recommendTeamWithRules(issue.issue_code, topProducts, directory);
      ownership = validateTeamRecommendation(rec, entries);
      reason = rec.reason;
      action = rec.recommended_action;
    }
  }
  ownership = ownership!;
  if (ownership.status !== "RECOMMENDED") {
    action = action.startsWith("Manual assignment required") ? action : `Manual assignment required. ${action}`;
  }
  notes.push(...ownership.notes);

  const method: "AI" | "RULES" = rcaMethod === "AI" && teamMethod === "AI" ? "AI" : "RULES";
  const primary = ownership.status === "RECOMMENDED" ? ownership.primary : null;
  const secondary = ownership.status === "RECOMMENDED" ? ownership.secondary : [];

  const inputSnapshot = {
    metrics: evidence.metrics,
    affected_channels: evidence.affected_channels,
    affected_products: evidence.affected_products,
    affected_locations: evidence.affected_locations,
    specific_issue_labels: evidence.specific_issue_labels,
    sample_interaction_ids: signals.map((s) => s.id),
    directory_team_ids: directory.map((d) => d.team_id),
    methods: { root_cause: rcaMethod, team_recommendation: teamMethod },
  };

  const analysisId = await sql.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into issue_analyses (
        bank_id, issue_id, method, model, observed_pattern, likely_root_cause, root_cause_status,
        root_cause_confidence, alternative_causes, affected_systems, recommended_investigation,
        management_insight, ownership_status, primary_department_id, primary_team_id,
        primary_team_confidence, secondary_teams, ownership_reason, recommended_action,
        validation_notes, input_snapshot
      ) values (
        ${bank.id}, ${issue.id}, ${method}, ${model}, ${rootCause.observed_pattern},
        ${rootCause.root_cause.description}, ${rootCause.root_cause.status}, ${rootCause.root_cause.confidence},
        ${tx.json(rootCause.alternative_causes as never)}, ${tx.json(rootCause.affected_systems as never)},
        ${tx.json(rootCause.recommended_investigation as never)}, ${rootCause.management_insight},
        ${ownership.status}, ${primary?.department_id || null}, ${primary?.team_id ?? null},
        ${primary?.confidence ?? null},
        ${tx.json(secondary.map((s) => ({ team_id: s.team_id, team_name: s.team_name, reason: s.reason })) as never)},
        ${reason || null}, ${action}, ${tx.json(notes as never)}, ${tx.json(inputSnapshot as never)}
      )
      returning id`;

    await writeAudit(
      {
        bankId: bank.id,
        issueId: issue.id,
        eventType: "ROOT_CAUSE_ANALYSIS",
        actor,
        method: rcaMethod,
        model,
        inputData: inputSnapshot,
        detectedIssue: issue.issue_code,
        rootCause: `${rootCause.root_cause.status}: ${rootCause.root_cause.description}`,
        confidence: rootCause.root_cause.confidence,
        finalStatus: issue.status,
        details: { analysis_id: row!.id },
      },
      tx,
    );
    await writeAudit(
      {
        bankId: bank.id,
        issueId: issue.id,
        eventType: ownership.status === "REJECTED_INVALID_TEAM" ? "RECOMMENDATION_REJECTED" : "TEAM_RECOMMENDATION",
        actor,
        method: teamMethod,
        model,
        detectedIssue: issue.issue_code,
        recommendedTeamId: primary?.team_id ?? null,
        recommendedTeamName: primary?.team_name ?? ownership.status,
        confidence: primary?.confidence ?? null,
        finalStatus: issue.status,
        details: {
          analysis_id: row!.id,
          ownership_status: ownership.status,
          secondary_teams: secondary.map((s) => s.team_name),
          validation_notes: ownership.notes,
        },
      },
      tx,
    );
    return row!.id;
  });

  return { analysisId, method, ownershipStatus: ownership.status };
}

/** Issues that warrant root-cause analysis: significant trend or high risk, not resolved. */
export async function listSignificantIssues(bankId: string) {
  const issues = await listIssues(bankId, { view: "active" });
  return issues.filter(
    (i) => SIGNIFICANT_TRENDS.includes(i.trend_status) || i.risk_level === "HIGH" || i.risk_level === "CRITICAL",
  );
}
