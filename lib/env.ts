import { z } from "zod";

/**
 * Server-side environment. Never import this from a client component —
 * secrets stay on the server.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined)),
  // Fast tier: bulk complaint classification. Deep tier: root cause, team routing, Ask ServicePulse.
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  ANTHROPIC_MODEL_DEEP: z.string().default("claude-opus-5-5"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  ANALYSIS_PERIOD_DAYS: z.coerce.number().int().min(1).max(90).default(7),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

export function aiConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}
