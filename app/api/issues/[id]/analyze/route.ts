import { NextResponse } from "next/server";
import { analyzeIssue, IssueNotFoundError } from "@/lib/ai/analyze-issue";
import { ApiError, withBank } from "@/lib/api";
import { uuid } from "@/lib/validation/api";

export const maxDuration = 60;

/** Runs root-cause analysis and responsible-team recommendation for one issue. */
export const POST = withBank<{ params: Promise<{ id: string }> }>(async (_req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid issue id");
  try {
    const outcome = await analyzeIssue(bank, id, "Demo User");
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof IssueNotFoundError) throw new ApiError(404, "Issue not found");
    throw err;
  }
});
