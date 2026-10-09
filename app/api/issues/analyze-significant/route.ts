import { NextResponse } from "next/server";
import { analyzeIssue, listSignificantIssues } from "@/lib/ai/analyze-issue";
import { mapWithConcurrency } from "@/lib/ai/claude";
import { withBank } from "@/lib/api";

export const maxDuration = 60;

/**
 * Analyses significant issues (emerging trend or high risk) that have no
 * analysis yet. Processes up to 2 per request (in parallel, so each request stays within the 60s limit); the client repeats while
 * `remaining > 0`. Individual issues can be re-analysed from their page.
 */
export const POST = withBank(async (_req, bank) => {
  const significant = await listSignificantIssues(bank.id);
  const needsAnalysis = significant.filter((i) => !i.analysis_id);
  const batch = needsAnalysis.slice(0, 2);
  const results = await mapWithConcurrency(batch, 2, (issue) => analyzeIssue(bank, issue.id, "Demo User"));
  return NextResponse.json({
    analysed: results.length,
    remaining: needsAnalysis.length - batch.length,
    significant: significant.length,
  });
});
