import "server-only";
import { CHALLENGE_SET, type ChallengeItem } from "@/data/evaluation/challenge-set";
import { groundTruthFor, truthKey } from "@/data/seed/ground-truth";
import { BATCH_SIZE, classifyBatch, type PendingInteraction } from "@/lib/ai/classify";
import { AIUnavailableError, mapWithConcurrency, modelFor } from "@/lib/ai/claude";
import { classifyWithRules } from "@/lib/ai/rules/classifier";
import type { Channel } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { aiConfigured } from "@/lib/env";
import type { Bank } from "@/types";

/**
 * Classification accuracy, measured against labelled ground truth.
 *
 * 1. Held-out challenge set (headline): new phrasings never used to build
 *    the rules or prompts. Rules are scored live; the AI is scored on demand
 *    and the run is stored in the audit log (ids + predictions only).
 * 2. Seeded demo data (in-distribution): stored classifications vs the
 *    scenario each synthetic message was generated from.
 */

const rulesInput = (channel: Channel, message: string) => ({
  channel,
  message,
  product: null,
  location: null,
  branch: null,
  amount: null,
});

export interface ItemResult {
  id: string;
  channel: Channel;
  message: string;
  expected: string;
  rules: string;
  ai: string | null; // null = AI not run / unavailable for this item
  aiConfidence: number | null;
}

export interface GroupScore {
  group: string;
  n: number;
  rulesCorrect: number;
  aiN: number;
  aiCorrect: number;
}

export interface Score {
  n: number;
  correct: number;
  accuracy: number | null; // 0..1
}

export interface ChallengeReport {
  ranAt: Date | null;
  model: string | null;
  items: ItemResult[];
  rules: Score;
  ai: Score;
  groups: GroupScore[];
}

const score = (n: number, correct: number): Score => ({ n, correct, accuracy: n === 0 ? null : correct / n });

export function summarise(items: ItemResult[], ranAt: Date | null, model: string | null): ChallengeReport {
  const groups = new Map<string, GroupScore>();
  for (const i of items) {
    const g = groups.get(i.expected) ?? { group: i.expected, n: 0, rulesCorrect: 0, aiN: 0, aiCorrect: 0 };
    g.n++;
    if (i.rules === i.expected) g.rulesCorrect++;
    if (i.ai !== null) {
      g.aiN++;
      if (i.ai === i.expected) g.aiCorrect++;
    }
    groups.set(i.expected, g);
  }
  const aiItems = items.filter((i) => i.ai !== null);
  return {
    ranAt,
    model,
    items,
    rules: score(items.length, items.filter((i) => i.rules === i.expected).length),
    ai: score(aiItems.length, aiItems.filter((i) => i.ai === i.expected).length),
    groups: [...groups.values()],
  };
}

function rulesOnly(item: ChallengeItem): ItemResult {
  return {
    ...item,
    rules: classifyWithRules(rulesInput(item.channel, item.message)).issue_group,
    ai: null,
    aiConfidence: null,
  };
}

interface StoredRun {
  model: string | null;
  results: { id: string; ai: string | null; confidence: number | null }[];
}

/** Latest stored AI run (if any) combined with live rules scoring. */
export async function getChallengeReport(bankId: string): Promise<ChallengeReport> {
  const [row] = await sql<{ details: StoredRun; created_at: Date }[]>`
    select details, created_at from audit_log
    where bank_id = ${bankId} and event_type = 'EVALUATION_RUN'
    order by created_at desc limit 1`;
  const byId = new Map((row?.details.results ?? []).map((r) => [r.id, r]));
  const items = CHALLENGE_SET.map((c) => {
    const base = rulesOnly(c);
    const stored = byId.get(c.id);
    return stored ? { ...base, ai: stored.ai, aiConfidence: stored.confidence } : base;
  });
  return summarise(items, row?.created_at ?? null, row?.details.model ?? null);
}

/** Classifies the challenge set with the AI (fast tier) and stores the run. */
export async function runChallengeEvaluation(bank: Bank, actor: string): Promise<ChallengeReport> {
  const knownCodes = (
    await sql<{ issue_code: string }[]>`select issue_code from issues where bank_id = ${bank.id}`
  ).map((r) => r.issue_code);
  const inputs: PendingInteraction[] = CHALLENGE_SET.map((c) => ({
    id: c.id,
    channel: c.channel,
    message: c.message,
    branch: null,
    location: null,
    product: null,
    amount: null,
  }));
  const batches: PendingInteraction[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) batches.push(inputs.slice(i, i + BATCH_SIZE));

  const useAI = aiConfigured();
  const out = await mapWithConcurrency(batches, 4, (b) => classifyBatch(b, knownCodes, useAI));
  const rows = new Map(out.flatMap((o) => o.rows).map((r) => [r.id, r]));
  const notes = [...new Set(out.map((o) => o.note).filter((n): n is string => Boolean(n)))];
  const model = [...rows.values()].find((r) => r.model)?.model ?? (useAI ? modelFor("fast") : null);

  const results = CHALLENGE_SET.map((c) => {
    const r = rows.get(c.id);
    const fromAI = r?.method === "AI";
    return { id: c.id, ai: fromAI ? r.issue_group : null, confidence: fromAI ? r.confidence : null };
  });
  const report = summarise(
    CHALLENGE_SET.map((c, idx) => ({ ...rulesOnly(c), ai: results[idx]!.ai, aiConfidence: results[idx]!.confidence })),
    new Date(),
    model,
  );

  // Never store (and so never display) a run in which the AI scored nothing.
  if (report.ai.n === 0) throw new AIUnavailableError(notes[0] ?? "The AI returned no usable classifications");

  await writeAudit({
    bankId: bank.id,
    eventType: "EVALUATION_RUN",
    actor,
    method: "AI",
    model,
    details: {
      model,
      ai_accuracy: report.ai.accuracy,
      rules_accuracy: report.rules.accuracy,
      ai_scored: report.ai.n,
      items: CHALLENGE_SET.length,
      notes,
      results,
    },
  });
  return report;
}

// ---------------------------------------------------------------------------
// Seeded demo data (in-distribution)
// ---------------------------------------------------------------------------

export interface SeedReport {
  labelled: number;
  rules: Score;
  ai: Score;
  aiMisses: { message: string; expected: string; got: string; confidence: number | null }[];
}

/** Stored AI classifications of seeded messages vs generator ground truth; rules scored live. */
export async function getSeedReport(bank: Bank): Promise<SeedReport | null> {
  const truth = groundTruthFor(bank.slug);
  if (!truth) return null;
  const rows = await sql<
    {
      channel: Channel;
      message: string;
      customer_reference: string | null;
      issue_group: string | null;
      method: string | null;
      confidence: number | null;
    }[]
  >`
    select i.channel, i.message, i.customer_reference, c.issue_group, c.method, c.confidence
    from interactions i
    left join interaction_classifications c on c.interaction_id = i.id and c.bank_id = i.bank_id
    where i.bank_id = ${bank.id} and i.source = 'SEED'`;

  let labelled = 0;
  let rulesCorrect = 0;
  let aiN = 0;
  let aiCorrect = 0;
  const aiMisses: SeedReport["aiMisses"] = [];
  for (const r of rows) {
    const expected = truth.get(truthKey(r.customer_reference, r.message));
    if (!expected) continue;
    labelled++;
    if (classifyWithRules(rulesInput(r.channel, r.message)).issue_group === expected) rulesCorrect++;
    if (r.method === "AI" && r.issue_group) {
      aiN++;
      if (r.issue_group === expected) aiCorrect++;
      else if (aiMisses.length < 6)
        aiMisses.push({ message: r.message, expected, got: r.issue_group, confidence: r.confidence });
    }
  }
  return { labelled, rules: score(labelled, rulesCorrect), ai: score(aiN, aiCorrect), aiMisses };
}
