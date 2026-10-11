import { NextResponse } from "next/server";
import { AIUnavailableError } from "@/lib/ai/llm";
import { ApiError, withBank } from "@/lib/api";
import { aiConfigured } from "@/lib/env";
import { runChallengeEvaluation } from "@/lib/evaluation/accuracy";

export const maxDuration = 60;

/** Scores the AI classifier on the held-out challenge set and stores the run. */
export const POST = withBank(async (_req, bank) => {
  if (!aiConfigured()) throw new ApiError(400, "AI is not configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY to evaluate the AI");
  let report;
  try {
    report = await runChallengeEvaluation(bank, "Demo User");
  } catch (err) {
    if (err instanceof AIUnavailableError) throw new ApiError(502, `Evaluation not saved: ${err.message}`);
    throw err;
  }
  return NextResponse.json({ ai: report.ai, rules: report.rules, model: report.model });
});
