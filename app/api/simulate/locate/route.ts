import { NextResponse } from "next/server";
import { parseBody, withBank } from "@/lib/api";
import { locateSimulatedIssues } from "@/lib/simulation/incident";
import { LocateSimulationSchema } from "@/lib/validation/api";

/** Issue groups the given simulated interactions currently belong to (e.g. after consolidation). */
export const POST = withBank(async (req, bank) => {
  const { interactionIds } = await parseBody(req, LocateSimulationSchema);
  const issues = await locateSimulatedIssues(bank.id, interactionIds);
  return NextResponse.json({ issues });
});
