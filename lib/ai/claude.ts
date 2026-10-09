import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "@/lib/env";

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/**
 * Model tiers:
 *  - "fast": high-volume, latency-sensitive work (complaint classification) — Claude Haiku, low effort.
 *  - "deep": reasoning that judges and managers read (root cause, team routing, Ask ServicePulse) — Claude Opus.
 */
export type ModelTier = "fast" | "deep";

const EFFORT: Record<ModelTier, "low" | "medium"> = { fast: "low", deep: "medium" };

let client: Anthropic | undefined;

function getClient(): Anthropic {
  const { ANTHROPIC_API_KEY, AI_TIMEOUT_MS } = env();
  if (!ANTHROPIC_API_KEY) throw new AIUnavailableError("ANTHROPIC_API_KEY is not configured");
  client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

export function modelFor(tier: ModelTier): string {
  const { ANTHROPIC_MODEL_FAST, ANTHROPIC_MODEL_DEEP } = env();
  return tier === "fast" ? ANTHROPIC_MODEL_FAST : ANTHROPIC_MODEL_DEEP;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
}

/**
 * Calls Claude with a structured-output format derived from a Zod schema.
 * The SDK parses the response with the same schema; callers apply stricter
 * business validation afterwards.
 *
 * Errors are re-thrown as AIUnavailableError with a short, non-sensitive
 * message (prompt contents are never logged).
 */
export async function structuredCompletion<S extends z.ZodType>(params: {
  schema: S;
  name: string;
  system: string;
  user: string;
  tier: ModelTier;
}): Promise<StructuredResult<z.infer<S>>> {
  const anthropic = getClient();
  const model = modelFor(params.tier);
  // Server-side refusal fallback is available for Opus-tier models only.
  const fallback = params.tier === "deep" ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
  try {
    const message = await anthropic.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
      output_config: { effort: EFFORT[params.tier], format: betaZodOutputFormat(params.schema) },
      ...fallback,
    });
    if (message.stop_reason === "refusal") throw new AIUnavailableError("The model declined to answer");
    if (message.stop_reason === "max_tokens") throw new AIUnavailableError("The model response was truncated");
    if (message.parsed_output == null) throw new AIUnavailableError("The model returned no structured output");
    return { data: message.parsed_output as z.infer<S>, model: message.model };
  } catch (err) {
    if (err instanceof AIUnavailableError) throw err;
    const status = err instanceof Anthropic.APIError && err.status ? ` (HTTP ${err.status})` : "";
    const kind = err instanceof Error ? err.name : "UnknownError";
    console.warn(`[ai] ${params.name} call failed: ${kind}${status}`);
    throw new AIUnavailableError(`AI request failed: ${kind}${status}`);
  }
}

/** Runs async tasks with bounded concurrency, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}
