import { NextResponse } from "next/server";
import { classifyPending } from "@/lib/ai/classify";
import { parseBody, withBank } from "@/lib/api";
import { recomputeIssues } from "@/lib/clustering/aggregate";
import { clearSimulatedIncidents, locateSimulatedIssues, simulateIncident } from "@/lib/simulation/incident";
import { SimulateIncidentSchema } from "@/lib/validation/api";

export const maxDuration = 60;

/**
 * Demo: injects a burst of complaints describing one incident, classifies
 * just that batch (AI, or rules fallback), re-runs pattern detection and
 * returns the issue groups the complaints were normalised into. The client
 * then runs root-cause analysis on the main issue via /api/issues/[id]/analyze.
 */
export const POST = withBank(async (req, bank) => {
  const { scenario, count } = await parseBody(req, SimulateIncidentSchema);
  const sim = await simulateIncident(bank, scenario, count, "Demo User");
  const classified = await classifyPending(bank.id, sim.interactionIds.length, "Demo User", {
    onlyIds: sim.interactionIds,
  });
  await recomputeIssues(bank.id, { audit: true, actor: "SYSTEM", currency: bank.currency });
  const issues = await locateSimulatedIssues(bank.id, sim.interactionIds);
  return NextResponse.json({
    batchId: sim.batchId,
    injected: sim.interactionIds.length,
    aiCount: classified.aiCount,
    rulesCount: classified.rulesCount,
    notes: classified.notes,
    issues,
  });
});

/** Removes all simulated interactions for the active bank and recalculates issues. */
export const DELETE = withBank(async (_req, bank) => {
  const removed = await clearSimulatedIncidents(bank.id, "Demo User");
  if (removed > 0) await recomputeIssues(bank.id, { audit: true, actor: "SYSTEM", currency: bank.currency });
  return NextResponse.json({ removed });
});
