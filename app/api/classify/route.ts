import { NextResponse } from "next/server";
import { classifyPending } from "@/lib/ai/classify";
import { parseBody, withBank } from "@/lib/api";
import { recomputeIssues } from "@/lib/clustering/aggregate";
import { ClassifyRequestSchema } from "@/lib/validation/api";

export const maxDuration = 60;

/**
 * Classifies the next batch of PENDING interactions for the active bank,
 * then re-aggregates issues. The client calls this repeatedly until
 * `remaining` reaches 0 (keeps each request well within serverless limits).
 */
export const POST = withBank(async (req, bank) => {
  const { limit } = await parseBody(req, ClassifyRequestSchema);
  const outcome = await classifyPending(bank.id, limit, "Demo User");
  const recompute =
    outcome.processed > 0
      ? await recomputeIssues(bank.id, { audit: outcome.remaining === 0, actor: "SYSTEM", currency: bank.currency })
      : null;
  return NextResponse.json({ ...outcome, issues: recompute?.issues ?? null });
});
