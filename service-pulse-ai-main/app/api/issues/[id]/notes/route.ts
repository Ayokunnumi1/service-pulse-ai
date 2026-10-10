import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { addNote, getIssue } from "@/lib/db/issues";
import { sanitizeText } from "@/lib/utils/sanitize";
import { IssueNoteSchema, uuid } from "@/lib/validation/api";

/** Adds an internal note to an issue. */
export const POST = withBank<{ params: Promise<{ id: string }> }>(async (req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid issue id");
  const { note, author } = await parseBody(req, IssueNoteSchema);

  const issue = await getIssue(bank.id, id);
  if (!issue) throw new ApiError(404, "Issue not found");

  const clean = sanitizeText(note, 4000);
  const row = await addNote(bank.id, issue.id, sanitizeText(author, 80), clean);
  await writeAudit({
    bankId: bank.id,
    issueId: issue.id,
    eventType: "NOTE_ADDED",
    actor: author,
    detectedIssue: issue.issue_code,
    finalStatus: issue.status,
    details: { note_id: row.id },
  });
  return NextResponse.json({ id: row.id });
});
