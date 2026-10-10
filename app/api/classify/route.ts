import { NextResponse } from "next/server";
import { classifyPending } from "@/lib/ai/classify";
import { parseBody, withBank } from "@/lib/api";
import { recomputeIssues } from "@/lib/clustering/aggregate";
import { ClassifyRequestSchema } from "@/lib/validation/api";

export const maxDuration = 60;

/**
 * Ingestion and classification pipeline for incoming dispute streams (USSD, POS, Web).
 * Normalizes raw, unstructured customer complaints into core-banking dispute codes.
 * Once classified, we deterministically re-aggregate the SLAs and risk thresholds 
 * before returning the batch to the triage dashboard.
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
