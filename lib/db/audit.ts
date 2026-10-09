import "server-only";
import type postgres from "postgres";
import { sql } from "@/lib/db/client";
import type { AuditEntry } from "@/types";

export interface AuditInput {
  bankId: string;
  issueId?: string | null;
  eventType:
    | "CLASSIFICATION_BATCH"
    | "ISSUES_RECOMPUTED"
    | "DATA_IMPORTED"
    | "ROOT_CAUSE_ANALYSIS"
    | "TEAM_RECOMMENDATION"
    | "RECOMMENDATION_REJECTED"
    | "ISSUE_ASSIGNED"
    | "STATUS_CHANGED"
    | "NOTE_ADDED"
    | "DIRECTORY_UPDATED";
  actor: string;
  method?: "AI" | "RULES" | null;
  model?: string | null;
  inputData?: unknown;
  detectedIssue?: string | null;
  rootCause?: string | null;
  recommendedTeamId?: string | null;
  recommendedTeamName?: string | null;
  confidence?: number | null;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  humanOverride?: boolean | null;
  finalStatus?: string | null;
  details?: unknown;
}

type Executor = postgres.Sql | postgres.TransactionSql;

/** Appends an audit record. Never store raw customer messages here. */
export async function writeAudit(entry: AuditInput, db: Executor = sql): Promise<void> {
  const json = (v: unknown) => (v === undefined || v === null ? null : db.json(v as postgres.JSONValue));
  await db`
    insert into audit_log (
      bank_id, issue_id, event_type, actor, method, model, input_data, detected_issue, root_cause,
      recommended_team_id, recommended_team_name, confidence, assigned_team_id, assigned_team_name,
      human_override, final_status, details
    ) values (
      ${entry.bankId}, ${entry.issueId ?? null}, ${entry.eventType}, ${entry.actor}, ${entry.method ?? null},
      ${entry.model ?? null}, ${json(entry.inputData)}, ${entry.detectedIssue ?? null}, ${entry.rootCause ?? null},
      ${entry.recommendedTeamId ?? null}, ${entry.recommendedTeamName ?? null}, ${entry.confidence ?? null},
      ${entry.assignedTeamId ?? null}, ${entry.assignedTeamName ?? null}, ${entry.humanOverride ?? null},
      ${entry.finalStatus ?? null}, ${json(entry.details)}
    )`;
}

export async function listAudit(
  bankId: string,
  opts: { issueId?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  return sql<AuditEntry[]>`
    select a.id, a.issue_id, i.title as issue_title, a.event_type, a.actor, a.method, a.model,
           a.input_data, a.detected_issue, a.root_cause, a.recommended_team_name, a.confidence,
           a.assigned_team_name, a.human_override, a.final_status, a.details, a.created_at
    from audit_log a
    left join issues i on i.id = a.issue_id and i.bank_id = a.bank_id
    where a.bank_id = ${bankId}
      ${opts.issueId ? sql`and a.issue_id = ${opts.issueId}` : sql``}
    order by a.created_at desc
    limit ${limit}`;
}
