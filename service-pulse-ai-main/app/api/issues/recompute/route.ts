import { NextResponse } from "next/server";
import { withBank } from "@/lib/api";
import { recomputeIssues } from "@/lib/clustering/aggregate";

/** Re-runs deterministic pattern detection, trend and risk scoring. */
export const POST = withBank(async (_req, bank) => {
  const result = await recomputeIssues(bank.id, { audit: true, actor: "Demo User", currency: bank.currency });
  return NextResponse.json(result);
});
