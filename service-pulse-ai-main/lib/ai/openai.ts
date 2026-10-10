import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

let client: OpenAI | undefined;

function getClient(): OpenAI {
  const { OPENAI_API_KEY, AI_TIMEOUT_MS } = env();
  if (!OPENAI_API_KEY) throw new AIUnavailableError("OPENAI_API_KEY is not configured");
  client ??= new OpenAI({ apiKey: OPENAI_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 2 });
  return client;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
}

/**
 * Calls the model with an OpenAI strict JSON-schema response format derived
 * from a Zod schema. The SDK parses the response with the same schema;
 * callers apply stricter business validation afterwards.
 *
 * Errors are re-thrown as AIUnavailableError with a short, non-sensitive
 * message (prompt contents are never logged).
 */
export async function structuredCompletion<S extends z.ZodType>(params: {
  schema: S;
  name: string;
  system: string;
  user: string;
}): Promise<StructuredResult<z.infer<S>>> {
  const openai = getClient();
  const { OPENAI_MODEL } = env();
  try {
    const completion = await openai.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: zodResponseFormat(params.schema, params.name),
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new AIUnavailableError("The model declined to answer");
    if (!message?.parsed) throw new AIUnavailableError("The model returned no structured output");
    return { data: message.parsed as z.infer<S>, model: completion.model };
  } catch (err) {
    if (err instanceof AIUnavailableError) throw err;
    const status = err instanceof OpenAI.APIError ? ` (HTTP ${err.status})` : "";
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
