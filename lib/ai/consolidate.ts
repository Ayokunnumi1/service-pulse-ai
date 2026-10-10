import "server-only";
import { ISSUE_GROUP_BY_CODE, ISSUE_GROUPS, issueTitle } from "@/lib/constants";
import { recomputeIssues } from "@/lib/clustering/aggregate";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { aiConfigured } from "@/lib/env";
import { forAI } from "@/lib/utils/sanitize";
import { AIConsolidationSchema } from "@/lib/validation/ai";
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  consolidationUserPrompt,
  type ConsolidationGroup,
} from "@/prompts/issue-consolidation";
import type { Bank } from "@/types";
import { AIUnavailableError, structuredCompletion } from "./claude";

/**
 * Issue-group consolidation. The classifier may invent a new issue group when
 * none of the known ones fits; near-duplicates (SALARY_DELAY vs
 * SALARY_NOT_CREDITED) would split one problem across several issues and
 * understate its trend. This step asks the model to merge candidate groups
 * (any group outside the standard taxonomy) into the group describing the
 * same underlying problem, validates every target against the bank's data,
 * re-labels the affected classifications and recomputes the metrics.
 *
 * Decisions are audited, and remembered: a group merged before is merged
 * again deterministically without another AI call.
 */

const MIN_MERGE_CONFIDENCE = 0.6;
const MAX_CANDIDATES = 25;
/** Catch-all bucket of the rules fallback — mixed content, never merged wholesale. */
const EXCLUDED = new Set(["UNCATEGORISED"]);

export interface Merge {
  from: string;
  to: string;
  fromTitle: string;
  toTitle: string;
  complaints: number;
  reason: string;
  confidence: number | null;
  source: "AI" | "REMEMBERED";
}

export interface ConsolidationOutcome {
  candidates: number;
  merges: Merge[];
  kept: { code: string; title: string; reason: string }[];
  method: "AI" | "RULES" | null;
  model: string | null;
  notes: string[];
}

export function isCandidateGroup(code: string): boolean {
  return !ISSUE_GROUP_BY_CODE.has(code) && !EXCLUDED.has(code);
}

/** Groups in use at this bank that sit outside the standard taxonomy. */
export async function countCandidateGroups(bankId: string): Promise<number> {
  const rows = await sql<{ issue_group: string }[]>`
    select distinct issue_group from interaction_classifications where bank_id = ${bankId}`;
  return rows.filter((r) => isCandidateGroup(r.issue_group)).length;
}

async function rememberedMerges(bankId: string): Promise<Map<string, string>> {
  const rows = await sql<{ details: { merges?: { from: string; to: string }[] } | null }[]>`
    select details from audit_log
    where bank_id = ${bankId} and event_type = 'ISSUE_GROUPS_CONSOLIDATED'
    order by created_at`;
  const map = new Map<string, string>();
  for (const r of rows) for (const m of r.details?.merges ?? []) map.set(m.from, m.to);
  return map;
}

/** Follows merge chains (A→B→C gives C); returns null when the chain loops back. */
export function resolveTarget(code: string, map: Map<string, string>): string | null {
  const seen = new Set([code]);
  let current = map.get(code);
  while (current !== undefined && map.has(current)) {
    if (seen.has(current)) return null;
    seen.add(current);
    current = map.get(current);
  }
  return current === undefined || current === code ? null : current;
}

export async function consolidateIssueGroups(bank: Bank, actor: string): Promise<ConsolidationOutcome> {
  const groups = await sql<{ issue_group: string; n: number; labels: string[] }[]>`
    select issue_group, count(*)::int as n, (array_agg(distinct issue))[1:6] as labels
    from interaction_classifications where bank_id = ${bank.id}
    group by issue_group`;
  const counts = new Map(groups.map((g) => [g.issue_group, g.n]));
  const candidates = groups
    .filter((g) => isCandidateGroup(g.issue_group))
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_CANDIDATES);

  const outcome: ConsolidationOutcome = {
    candidates: candidates.length,
    merges: [],
    kept: [],
    method: null,
    model: null,
    notes: [],
  };
  if (candidates.length === 0) return outcome;

  // Valid merge targets: the standard taxonomy plus any group currently in use.
  const validTargets = new Set([...ISSUE_GROUPS.map((g) => g.code), ...counts.keys()].filter((c) => !EXCLUDED.has(c)));
  const plan = new Map<string, string>();
  const meta = new Map<string, Pick<Merge, "reason" | "confidence" | "source">>();

  // 1. Re-apply earlier decisions without another AI call.
  const remembered = await rememberedMerges(bank.id);
  for (const c of candidates) {
    const to = resolveTarget(c.issue_group, remembered);
    if (to && validTargets.has(to)) {
      plan.set(c.issue_group, to);
      meta.set(c.issue_group, {
        reason: "Previously merged — decision re-applied.",
        confidence: null,
        source: "REMEMBERED",
      });
    }
  }

  // 2. Ask the model about the rest.
  const open = candidates.filter((c) => !plan.has(c.issue_group));
  if (open.length > 0 && !aiConfigured()) {
    outcome.notes.push("AI not configured — only previously approved merges were applied.");
  } else if (open.length > 0) {
    const samples = await sql<{ issue_group: string; message: string }[]>`
      select issue_group, message from (
        select c.issue_group, i.message,
               row_number() over (partition by c.issue_group order by i.occurred_at desc) as rn
        from interaction_classifications c
        join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
        where c.bank_id = ${bank.id} and c.issue_group = any(${open.map((c) => c.issue_group)})
      ) t where rn <= 4`;
    const promptGroups: ConsolidationGroup[] = open.map((c) => ({
      code: c.issue_group,
      complaints: c.n,
      specific_issue_labels: c.labels.filter(Boolean),
      sample_messages: samples.filter((s) => s.issue_group === c.issue_group).map((s) => forAI(s.message, 240)),
    }));
    try {
      const res = await structuredCompletion({
        schema: AIConsolidationSchema,
        name: "issue_consolidation",
        tier: "deep",
        system: CONSOLIDATION_SYSTEM_PROMPT,
        user: consolidationUserPrompt(
          ISSUE_GROUPS.map((g) => ({ code: g.code, description: g.description })),
          promptGroups,
        ),
      });
      outcome.method = "AI";
      outcome.model = res.model;
      const openCodes = new Set(open.map((c) => c.issue_group));
      // Smaller groups first, so when two candidates point at each other the larger one survives.
      const decisions = res.data.decisions
        .filter((d) => openCodes.has(d.code))
        .sort((a, b) => (counts.get(a.code) ?? 0) - (counts.get(b.code) ?? 0));
      for (const d of decisions) {
        const target = d.target_code?.trim().toUpperCase() ?? null;
        const confidence = Math.max(0, Math.min(1, d.confidence));
        if (d.action !== "MERGE" || !target) {
          outcome.kept.push({ code: d.code, title: issueTitle(d.code), reason: d.reason });
          continue;
        }
        let rejection: string | null = null;
        if (!validTargets.has(target) || target === d.code) rejection = `target "${target}" is not a valid group`;
        else if (confidence < MIN_MERGE_CONFIDENCE)
          rejection = `confidence ${Math.round(confidence * 100)}% below threshold`;
        else if (resolveTarget(d.code, new Map([...plan, [d.code, target]])) === null)
          rejection = "merge would create a loop";
        if (rejection) {
          outcome.kept.push({ code: d.code, title: issueTitle(d.code), reason: `Kept: ${rejection}.` });
          continue;
        }
        plan.set(d.code, target);
        meta.set(d.code, { reason: d.reason, confidence, source: "AI" });
      }
      for (const c of open) {
        if (!plan.has(c.issue_group) && !outcome.kept.some((k) => k.code === c.issue_group)) {
          outcome.kept.push({
            code: c.issue_group,
            title: issueTitle(c.issue_group),
            reason: "No decision returned — kept.",
          });
        }
      }
    } catch (err) {
      outcome.notes.push(
        `${err instanceof AIUnavailableError ? err.message : "AI unavailable"} — only previously approved merges were applied.`,
      );
    }
  }

  // 3. Apply: resolve chains so every group points at its final target.
  for (const [from] of plan) {
    const to = resolveTarget(from, plan);
    if (!to) {
      plan.delete(from);
      continue;
    }
    const m = meta.get(from)!;
    outcome.merges.push({
      from,
      to,
      fromTitle: issueTitle(from),
      toTitle: issueTitle(to),
      complaints: counts.get(from) ?? 0,
      ...m,
    });
  }
  outcome.method ??= outcome.merges.length > 0 ? "RULES" : null;

  if (outcome.merges.length > 0) {
    await sql.begin(async (tx) => {
      for (const m of outcome.merges) {
        await tx`
          update interaction_classifications set issue_group = ${m.to}
          where bank_id = ${bank.id} and issue_group = ${m.from}`;
      }
    });
    await recomputeIssues(bank.id, { audit: false, actor: "SYSTEM", currency: bank.currency });
  }

  if (outcome.merges.length > 0 || outcome.kept.length > 0) {
    await writeAudit({
      bankId: bank.id,
      eventType: "ISSUE_GROUPS_CONSOLIDATED",
      actor,
      method: outcome.method,
      model: outcome.model,
      details: {
        candidates: outcome.candidates,
        merges: outcome.merges.map((m) => ({
          from: m.from,
          to: m.to,
          complaints: m.complaints,
          confidence: m.confidence,
          source: m.source,
          reason: m.reason,
        })),
        kept: outcome.kept.map((k) => ({ code: k.code, reason: k.reason })),
        notes: outcome.notes,
      },
    });
  }
  return outcome;
}
