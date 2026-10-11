import "./load-env";
import { modelFor, structuredCompletion } from "@/lib/ai/llm";
import { aiProvider } from "@/lib/env";
import { AIClassificationBatchSchema, ValidatedClassificationSchema } from "@/lib/validation/ai";

async function main() {
  console.log("provider:", aiProvider(), "| fast:", modelFor("fast"), "| deep:", modelFor("deep"));
  const t = Date.now();
  const { data, model } = await structuredCompletion({
    schema: AIClassificationBatchSchema,
    name: "smoke",
    tier: "fast",
    system: "Classify each bank customer complaint. Return one result per input id.",
    user: JSON.stringify([
      { id: "a1", channel: "WHATSAPP", text: "I sent 50k to my sister since morning, debited but she hasn't received it!!" },
      { id: "a2", channel: "EMAIL", text: "The mobile app keeps logging me out after the update, can't even check balance." },
    ]),
  });
  console.log(`model: ${model} | ${Date.now() - t}ms`);
  for (const r of data.results) {
    const v = ValidatedClassificationSchema.safeParse(r);
    console.log(r.id, r.category, r.issue_group, r.sentiment, r.severity, r.confidence, v.success ? "VALID" : "INVALID");
  }
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
