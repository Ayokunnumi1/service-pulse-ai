import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { getIssue, setIssueStatus } from "@/lib/db/issues";
import { IssueStatusSchema, uuid } from "@/lib/validation/api";

/** Moves an issue through OPEN → ASSIGNED → INVESTIGATING → RESOLVED. */
export const POST = withBank<{ params: Promise<{ id: string }> }>(async (req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid issue id");
  const { status, actor } = await parseBody(req, IssueStatusSchema);

  const issue = await getIssue(bank.id, id);
  if (!issue) throw new ApiError(404, "Issue not found");
  if ((status === "INVESTIGATING" || status === "ASSIGNED") && !issue.assigned_team_id) {
    throw new ApiError(409, "Assign the issue to a team first");
  }

  await setIssueStatus(bank.id, issue.id, status);
  await writeAudit({
    bankId: bank.id,
    issueId: issue.id,
    eventType: "STATUS_CHANGED",
    actor,
    detectedIssue: issue.issue_code,
    assignedTeamId: issue.assigned_team_id,
    assignedTeamName: issue.assigned_team_name,
    finalStatus: status,
    details: { from: issue.status, to: status },
  });
  return NextResponse.json({ status });
});
