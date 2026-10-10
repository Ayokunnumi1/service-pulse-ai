import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { getTeam } from "@/lib/db/directory";
import { addNote, assignIssue, getAnalysis, getIssue, listAnalyses } from "@/lib/db/issues";
import { AssignIssueSchema, uuid } from "@/lib/validation/api";

/**
 * Assigns an issue to a team — either by accepting the AI recommendation or
 * by a human override to another team from the bank's directory.
 */
export const POST = withBank<{ params: Promise<{ id: string }> }>(async (req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid issue id");
  const body = await parseBody(req, AssignIssueSchema);

  const issue = await getIssue(bank.id, id);
  if (!issue) throw new ApiError(404, "Issue not found");

  if (body.mode === "accept") {
    const analysis = await getAnalysis(bank.id, body.analysisId);
    if (!analysis || analysis.issue_id !== issue.id) throw new ApiError(404, "Recommendation not found");
    if (analysis.ownership_status !== "RECOMMENDED" || !analysis.primary_team_id) {
      throw new ApiError(409, "This recommendation has no valid owner — assign a team manually");
    }
    await assignIssue(bank.id, issue.id, analysis.primary_team_id, "AI_ACCEPTED");
    await writeAudit({
      bankId: bank.id,
      issueId: issue.id,
      eventType: "ISSUE_ASSIGNED",
      actor: body.actor,
      method: analysis.method,
      detectedIssue: issue.issue_code,
      rootCause: analysis.likely_root_cause,
      recommendedTeamId: analysis.primary_team_id,
      recommendedTeamName: analysis.primary_team_name,
      confidence: analysis.primary_team_confidence,
      assignedTeamId: analysis.primary_team_id,
      assignedTeamName: analysis.primary_team_name,
      humanOverride: false,
      finalStatus: issue.status === "OPEN" ? "ASSIGNED" : issue.status,
      details: { analysis_id: analysis.id },
    });
    return NextResponse.json({ assignedTeam: analysis.primary_team_name });
  }

  const team = await getTeam(bank.id, body.teamId);
  if (!team) throw new ApiError(400, "Team does not exist in this bank's directory");

  const [latest] = await listAnalyses(bank.id, issue.id);
  const recommendedTeamId = latest?.ownership_status === "RECOMMENDED" ? latest.primary_team_id : null;

  await assignIssue(bank.id, issue.id, team.id, "MANUAL_OVERRIDE");
  await addNote(bank.id, issue.id, body.actor, `Assigned to ${team.name} (manual override). Reason: ${body.reason}`);
  await writeAudit({
    bankId: bank.id,
    issueId: issue.id,
    eventType: "ISSUE_ASSIGNED",
    actor: body.actor,
    detectedIssue: issue.issue_code,
    rootCause: latest?.likely_root_cause ?? null,
    recommendedTeamId,
    recommendedTeamName: latest ? (latest.primary_team_name ?? latest.ownership_status) : null,
    confidence: latest?.primary_team_confidence ?? null,
    assignedTeamId: team.id,
    assignedTeamName: team.name,
    humanOverride: recommendedTeamId !== team.id,
    finalStatus: issue.status === "OPEN" ? "ASSIGNED" : issue.status,
    details: { reason: body.reason, analysis_id: latest?.id ?? null },
  });
  return NextResponse.json({ assignedTeam: team.name });
});
