import { NextResponse } from "next/server";
import { askServicePulse } from "@/lib/ai/assistant";
import { parseBody, withBank } from "@/lib/api";
import { AssistantRequestSchema } from "@/lib/validation/api";

export const maxDuration = 60;

/** "Ask ServicePulse": answers management questions grounded in the bank's data. */
export const POST = withBank(async (req, bank) => {
  const { question } = await parseBody(req, AssistantRequestSchema);
  const response = await askServicePulse(bank, question);
  return NextResponse.json(response);
});
