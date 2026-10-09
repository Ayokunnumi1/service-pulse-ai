import { NextResponse } from "next/server";
import { queueReclassification } from "@/lib/ai/classify";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { aiConfigured } from "@/lib/env";
import { ReclassifyRequestSchema } from "@/lib/validation/api";

/**
 * Moves classified interactions back to PENDING so the AI can re-classify
 * them (by default only those the rules fallback handled). The client then
 * drives /api/classify in batches, exactly like a first-time classification.
 */
export const POST = withBank(async (req, bank) => {
  const { scope } = await parseBody(req, ReclassifyRequestSchema);
  if (!aiConfigured()) throw new ApiError(400, "AI is not configured — set ANTHROPIC_API_KEY to re-classify with AI");
  const queued = await queueReclassification(bank.id, scope, "Demo User");
  return NextResponse.json({ queued });
});
