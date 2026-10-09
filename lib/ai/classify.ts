import "server-only";
import type { Channel } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { aiConfigured } from "@/lib/env";
import { forAI } from "@/lib/utils/sanitize";
import {
  AIClassificationBatchSchema,
  ValidatedClassificationSchema,
  type ClassificationResult,
} from "@/lib/validation/ai";
import {
  classificationSystemPrompt,
  classificationUserPrompt,
  type ClassificationPromptItem,
} from "@/prompts/complaint-classification";
import { AIUnavailableError, mapWithConcurrency, structuredCompletion } from "./claude";
import { classifyWithRules } from "./rules/classifier";

const BATCH_SIZE = 20;
const CONCURRENCY = 3;

interface PendingInteraction {
  id: string;
  channel: Channel;
  message: string;
  branch: string | null;
  location: string | null;
  product: string | null;
  amount: number | null;
}

interface ClassifiedRow extends ClassificationResult {
  method: "AI" | "RULES";
  model: string | null;
}

export interface ClassifyOutcome {
  processed: number;
  aiCount: number;
  rulesCount: number;
  remaining: number;
  aiAvailable: boolean;
  notes: string[];
}

async function classifyBatch(
  batch: PendingInteraction[],
  knownCodes: string[],
  useAI: boolean,
): Promise<{ rows: ClassifiedRow[]; note: string | null }> {
  const rules = (i: PendingInteraction): ClassifiedRow => ({
    id: i.id,
    ...classifyWithRules(i),
    method: "RULES",
    model: null,
  });

  if (!useAI) return { rows: batch.map(rules), note: null };

  // Short ids keep prompts small and avoid the model mangling UUIDs.
  const items: ClassificationPromptItem[] = batch.map((i, idx) => ({
    id: `m${idx + 1}`,
    channel: i.channel,
    branch: i.branch,
    location: i.location,
    product_hint: i.product,
    message: forAI(i.message),
  }));

  try {
    const { data, model } = await structuredCompletion({
      schema: AIClassificationBatchSchema,
      name: "complaint_classification",
      tier: "fast",
      system: classificationSystemPrompt(knownCodes),
      user: classificationUserPrompt(items),
    });
    const byShortId = new Map(data.results.map((r) => [r.id, r]));
    let invalid = 0;
    const rows = batch.map((interaction, idx) => {
      const raw = byShortId.get(`m${idx + 1}`);
      const parsed = raw ? ValidatedClassificationSchema.safeParse(raw) : null;
      if (!parsed?.success) {
        invalid++;
        return rules(interaction);
      }
      return { ...parsed.data, id: interaction.id, channel: interaction.channel, method: "AI" as const, model };
    });
    return {
      rows,
      note: invalid > 0 ? `${invalid} AI result(s) failed validation and used the rules fallback.` : null,
    };
  } catch (err) {
    const reason = err instanceof AIUnavailableError ? err.message : "AI request failed";
    return { rows: batch.map(rules), note: `${reason} — rules fallback used for ${batch.length} interaction(s).` };
  }
}

export type ReclassifyScope = "RULES" | "ALL";

/**
 * Queues already-classified interactions for re-classification by moving
 * them back to PENDING. Existing classifications stay in place (and keep
 * feeding the dashboards) until the next classification run overwrites them.
 * Scope "RULES" re-queues only interactions the rules fallback classified.
 */
export async function queueReclassification(bankId: string, scope: ReclassifyScope, actor = "SYSTEM"): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    update interactions i set status = 'PENDING'
    from interaction_classifications c
    where i.bank_id = ${bankId} and c.bank_id = i.bank_id and c.interaction_id = i.id
      and i.status = 'CLASSIFIED' ${scope === "RULES" ? sql`and c.method = 'RULES'` : sql``}
    returning i.id`;
  if (rows.length > 0) {
    await writeAudit({
      bankId,
      eventType: "RECLASSIFICATION_QUEUED",
      actor,
      details: { scope, interactions: rows.length },
    });
  }
  return rows.length;
}

/**
 * Classifies up to `limit` PENDING interactions for one bank.
 * Every result is validated with Zod before it is stored.
 */
export async function classifyPending(
  bankId: string,
  limit: number,
  actor = "SYSTEM",
  opts: { onlyIds?: string[] } = {},
): Promise<ClassifyOutcome> {
  const pending = await sql<PendingInteraction[]>`
    select id, channel, message, branch, location, product, amount
    from interactions
    where bank_id = ${bankId} and status = 'PENDING'
      ${opts.onlyIds ? sql`and id = any(${opts.onlyIds})` : sql``}
    order by occurred_at
    limit ${limit}`;

  const useAI = aiConfigured();
  if (pending.length === 0) {
    return { processed: 0, aiCount: 0, rulesCount: 0, remaining: 0, aiAvailable: useAI, notes: [] };
  }

  const knownCodes = (await sql<{ issue_code: string }[]>`select issue_code from issues where bank_id = ${bankId}`).map(
    (r) => r.issue_code,
  );

  const batches: PendingInteraction[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));

  const results = await mapWithConcurrency(batches, CONCURRENCY, (b) => classifyBatch(b, knownCodes, useAI));
  const rows = results.flatMap((r) => r.rows);
  const notes = [...new Set(results.map((r) => r.note).filter((n): n is string => Boolean(n)))];

  await sql.begin(async (tx) => {
    const records = rows.map((r) => ({
      interaction_id: r.id,
      bank_id: bankId,
      category: r.category,
      issue: r.issue,
      issue_group: r.issue_group,
      intent: r.intent,
      sentiment: r.sentiment,
      severity: r.severity,
      product: r.product,
      channel: r.channel,
      location: r.location,
      systemic_issue_candidate: r.systemic_issue_candidate,
      confidence: Math.round(r.confidence * 1000) / 1000,
      method: r.method,
      model: r.model,
    }));
    await tx`
      insert into interaction_classifications ${tx(records)}
      on conflict (interaction_id) do update set
        category = excluded.category, issue = excluded.issue, issue_group = excluded.issue_group,
        intent = excluded.intent, sentiment = excluded.sentiment, severity = excluded.severity,
        product = excluded.product, channel = excluded.channel, location = excluded.location,
        systemic_issue_candidate = excluded.systemic_issue_candidate, confidence = excluded.confidence,
        method = excluded.method, model = excluded.model, classified_at = now()`;
    await tx`
      update interactions set status = 'CLASSIFIED'
      where bank_id = ${bankId} and id = any(${rows.map((r) => r.id)})`;
  });

  const aiCount = rows.filter((r) => r.method === "AI").length;
  const rulesCount = rows.length - aiCount;
  const groups: Record<string, number> = {};
  for (const r of rows) groups[r.issue_group] = (groups[r.issue_group] ?? 0) + 1;

  await writeAudit({
    bankId,
    eventType: "CLASSIFICATION_BATCH",
    actor,
    method: aiCount > 0 ? "AI" : "RULES",
    model: rows.find((r) => r.model)?.model ?? null,
    inputData: { interaction_ids: rows.map((r) => r.id), count: rows.length },
    details: { ai_classified: aiCount, rules_classified: rulesCount, issue_groups: groups, notes },
  });

  const [counter] = await sql<{ remaining: number }[]>`
    select count(*)::int as remaining from interactions where bank_id = ${bankId} and status = 'PENDING'`;

  return { processed: rows.length, aiCount, rulesCount, remaining: counter?.remaining ?? 0, aiAvailable: useAI, notes };
}
