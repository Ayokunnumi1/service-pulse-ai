import "server-only";
import { issueTitle } from "@/lib/constants";
import { sql } from "@/lib/db/client";

/**
 * Human feedback loop for team routing. Every assignment is already audited
 * (ISSUE_ASSIGNED: AI-recommended team, team the human chose, reason). Each
 * decision becomes a routing precedent:
 *   - CORRECTION: the human chose a different team than the AI recommended
 *   - MANUAL:     the human assigned an owner where the AI had none
 *   - CONFIRMED:  the human accepted the AI recommendation
 * Precedents are fed to the team-recommendation prompt (and used directly by
 * the rules fallback), so each correction improves future recommendations.
 * Only decisions whose team still exists in the directory are used.
 */

export type DecisionKind = "CORRECTION" | "MANUAL" | "CONFIRMED";

export interface RoutingDecision {
  issueId: string;
  issueCode: string;
  issueTitle: string;
  rootCause: string | null;
  kind: DecisionKind;
  recommendedTeamName: string | null;
  assignedTeamId: string;
  assignedTeamName: string;
  reason: string | null;
  actor: string;
  decidedAt: Date;
}

export async function listRoutingDecisions(bankId: string, limit = 50): Promise<RoutingDecision[]> {
  const rows = await sql<
    {
      issue_id: string;
      detected_issue: string | null;
      root_cause: string | null;
      recommended_team_id: string | null;
      recommended_team_name: string | null;
      assigned_team_id: string;
      assigned_team_name: string;
      human_override: boolean | null;
      reason: string | null;
      actor: string;
      created_at: Date;
    }[]
  >`
    select a.issue_id, a.detected_issue, a.root_cause, a.recommended_team_id, a.recommended_team_name,
           a.assigned_team_id, t.name as assigned_team_name, a.human_override,
           a.details->>'reason' as reason, a.actor, a.created_at
    from audit_log a
    join teams t on t.id = a.assigned_team_id and t.bank_id = a.bank_id
    where a.bank_id = ${bankId} and a.event_type = 'ISSUE_ASSIGNED' and a.issue_id is not null
    order by a.created_at desc
    limit ${limit}`;

  return rows.map((r) => ({
    issueId: r.issue_id,
    issueCode: r.detected_issue ?? "UNKNOWN",
    issueTitle: issueTitle(r.detected_issue ?? "UNKNOWN"),
    rootCause: r.root_cause,
    kind: !r.human_override ? "CONFIRMED" : r.recommended_team_id ? "CORRECTION" : "MANUAL",
    recommendedTeamName: r.recommended_team_id ? r.recommended_team_name : null,
    assignedTeamId: r.assigned_team_id,
    assignedTeamName: r.assigned_team_name,
    reason: r.reason,
    actor: r.actor,
    decidedAt: r.created_at,
  }));
}

/**
 * Precedents relevant to one issue: decisions on the same issue group first,
 * then human corrections/manual assignments on other groups (most recent),
 * which teach the model how this bank routes in general.
 */
export function selectPrecedents(decisions: RoutingDecision[], issueCode: string, max = 8): RoutingDecision[] {
  const same = decisions.filter((d) => d.issueCode === issueCode);
  const others = decisions.filter((d) => d.issueCode !== issueCode && d.kind !== "CONFIRMED");
  const seen = new Set<string>();
  return [...same, ...others]
    .filter((d) => {
      const key = `${d.issueId}:${d.assignedTeamId}:${d.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

/**
 * The human-taught owner for an issue group: the team of the latest decision
 * on that group, provided a manager chose that team themselves at some point
 * (a correction or manual assignment — later acceptance of it keeps the
 * lesson). Returns that human decision so its reason can be cited.
 */
export function humanOwnerFor(decisions: RoutingDecision[], issueCode: string): RoutingDecision | null {
  const forCode = decisions.filter((d) => d.issueCode === issueCode); // newest first
  const current = forCode[0];
  if (!current) return null;
  return forCode.find((d) => d.kind !== "CONFIRMED" && d.assignedTeamId === current.assignedTeamId) ?? null;
}

export interface FeedbackStats {
  decisions: number;
  confirmed: number;
  corrected: number;
  manual: number;
  acceptanceRate: number | null; // confirmed / (confirmed + corrected)
}

export function feedbackStats(decisions: RoutingDecision[]): FeedbackStats {
  const confirmed = decisions.filter((d) => d.kind === "CONFIRMED").length;
  const corrected = decisions.filter((d) => d.kind === "CORRECTION").length;
  const manual = decisions.filter((d) => d.kind === "MANUAL").length;
  return {
    decisions: decisions.length,
    confirmed,
    corrected,
    manual,
    acceptanceRate: confirmed + corrected === 0 ? null : confirmed / (confirmed + corrected),
  };
}
