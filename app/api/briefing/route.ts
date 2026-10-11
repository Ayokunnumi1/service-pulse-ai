import { NextResponse } from "next/server";
import { generateBriefing } from "@/lib/ai/briefing";
import { withBank } from "@/lib/api";

export const maxDuration = 60;

/** Generates (and stores) today's executive briefing for the active bank. */
export const POST = withBank(async (_req, bank) => {
  const view = await generateBriefing(bank, "Demo User");
  return NextResponse.json({ method: view.method, note: view.note });
});
