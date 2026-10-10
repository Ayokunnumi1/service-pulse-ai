import { NextResponse } from "next/server";
import { consolidateIssueGroups } from "@/lib/ai/consolidate";
import { withBank } from "@/lib/api";

export const maxDuration = 60;

/**
 * Merges near-duplicate issue groups created by the classifier into the group
 * describing the same underlying problem, then recomputes trends and risk.
 */
export const POST = withBank(async (_req, bank) => {
  const outcome = await consolidateIssueGroups(bank, "Demo User");
  return NextResponse.json(outcome);
});
