import "server-only";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { listIssues } from "@/lib/db/issues";
import { aiConfigured } from "@/lib/env";
import { AIBriefingSchema, type Briefing } from "@/lib/validation/ai";
import { BRIEFING_SYSTEM_PROMPT, briefingUserPrompt } from "@/prompts/daily-briefing";
import type { Bank } from "@/types";
import { buildSnapshot, type Snapshot } from "./assistant";
import { AIUnavailableError, structuredCompletion } from "./llm";

/**
 * "Today's briefing": a three-point executive summary at the top of the
 * dashboard, written from the same database-computed snapshot as Ask
 * ServicePulse (the model phrases figures, it never computes them). The
 * latest briefing is stored in the audit log so the dashboard loads it
 * instantly; it is flagged stale once issue metrics change.
 */

const URGENT_TRENDS = new Set(["Critical", "High concern", "Emerging"]);
const signed = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`;

/** "Likely: Likely X." → "Likely X" (snapshot causes carry a status prefix; keep them hedged). */
function hedgedCause(cause: string): string {
  const text = cause
    .replace(/^[A-Za-z ]+:\s*/, "")
    .trim()
    .replace(/\.+$/, "");
  return /^(likely|possible|possibly|requires)/i.test(text) ? text : `Likely cause: ${text}`;
}

/** Deterministic briefing from the snapshot (AI fallback). */
export function briefingWithRules(s: Snapshot): Briefing {
  const issues = s.issues_ranked_by_risk.filter((i) => i.total_complaints > 0);
  if (issues.length === 0) {
    return {
      headline: "No active issues have been detected yet.",
      points: [],
      recommended_focus: "Classify pending customer interactions so ServicePulse can detect issues.",
      data_limitations: `${s.totals.unclassified_interactions} interactions are awaiting classification.`,
    };
  }
  const urgency = (i: (typeof issues)[number]) =>
    (i.risk_level === "CRITICAL" ? 4 : i.risk_level === "HIGH" ? 3 : 0) + (URGENT_TRENDS.has(i.trend) ? 2 : 0);
  const top = [...issues].sort((a, b) => urgency(b) - urgency(a) || b.risk_score - a.risk_score).slice(0, 3);
  const owner = (i: (typeof issues)[number]) => i.assigned_team ?? i.recommended_team;

  const points = top.map((i) => {
    const growth = i.growth_pct === null ? "a new issue this period" : `${signed(i.growth_pct)} vs the previous period`;
    const where = i.top_locations[0] ? ` Most affected: ${i.top_locations[0]}.` : "";
    const cause =
      i.likely_root_cause !== "Not yet analysed" ? ` ${hedgedCause(i.likely_root_cause)}.` : " Not yet analysed.";
    const who = owner(i) ? ` Owner: ${owner(i)}${i.assigned_team ? "" : " (recommended)"}.` : " No owner assigned yet.";
    return {
      title: `${i.title} — ${i.trend}`,
      detail:
        `${i.current_period_complaints} complaints this period (${growth}), ${i.risk_level.toLowerCase()} risk ` +
        `(${i.risk_score}/100).${where}${cause}${who}`,
      issue_codes: [i.issue_code],
    };
  });

  const lead = top[0]!;
  const actions = top.map((i) =>
    owner(i) ? `confirm ${i.title} is being investigated by ${owner(i)}` : `assign an owner to ${i.title}`,
  );
  const notAnalysed = top.filter((i) => i.likely_root_cause === "Not yet analysed").length;
  const limits = [
    s.totals.unclassified_interactions > 0 &&
      `${s.totals.unclassified_interactions} interactions are not yet classified.`,
    notAnalysed > 0 &&
      `${notAnalysed} of these issues ${notAnalysed === 1 ? "has" : "have"} no root-cause analysis yet.`,
  ].filter(Boolean);

  return {
    headline:
      `${lead.title} is the top priority: ${lead.risk_level.toLowerCase()} risk (${lead.risk_score}/100)` +
      (lead.growth_pct === null ? ", newly emerging." : `, ${signed(lead.growth_pct)} vs the previous period.`),
    points,
    recommended_focus: `Today: ${actions.join("; ")}.`,
    data_limitations: limits.length ? limits.join(" ") : null,
  };
}

export interface BriefingView {
  briefing: Briefing;
  method: "AI" | "RULES";
  model: string | null;
  generatedAt: Date;
  stale: boolean;
  issueLinks: Record<string, string>; // issue_code → issue id
  note: string | null;
}

export async function generateBriefing(bank: Bank, actor: string): Promise<BriefingView> {
  const snapshot = await buildSnapshot(bank);
  const known = new Set(snapshot.issues_ranked_by_risk.map((i) => i.issue_code));

  let briefing: Briefing;
  let method: "AI" | "RULES" = "RULES";
  let model: string | null = null;
  let note: string | null = null;

  if (aiConfigured()) {
    try {
      const res = await structuredCompletion({
        schema: AIBriefingSchema,
        name: "daily_briefing",
        tier: "deep",
        system: BRIEFING_SYSTEM_PROMPT,
        user: briefingUserPrompt(snapshot),
      });
      const points = res.data.points
        .slice(0, 3)
        .map((p) => ({ ...p, issue_codes: p.issue_codes.filter((c) => known.has(c)) }))
        .filter((p) => p.title.trim() && p.detail.trim());
      if (points.length === 0 && known.size > 0) throw new AIUnavailableError("The AI briefing had no usable points");
      briefing = { ...res.data, points };
      method = "AI";
      model = res.model;
    } catch (err) {
      note = `${err instanceof AIUnavailableError ? err.message : "AI unavailable"} — deterministic briefing shown.`;
      briefing = briefingWithRules(snapshot);
    }
  } else {
    note = "AI not configured — deterministic briefing computed from the same data.";
    briefing = briefingWithRules(snapshot);
  }

  await writeAudit({
    bankId: bank.id,
    eventType: "BRIEFING_GENERATED",
    actor,
    method,
    model,
    details: { briefing, note },
  });
  return {
    briefing,
    method,
    model,
    generatedAt: new Date(),
    stale: false,
    issueLinks: await issueLinks(bank.id),
    note,
  };
}

async function issueLinks(bankId: string): Promise<Record<string, string>> {
  const issues = await listIssues(bankId, { view: "all" });
  return Object.fromEntries(issues.map((i) => [i.issue_code, i.id]));
}

/** Latest stored briefing, flagged stale if issue metrics changed after it was written. */
export async function getLatestBriefing(bankId: string): Promise<BriefingView | null> {
  const [row] = await sql<
    {
      details: { briefing: Briefing; note: string | null };
      method: "AI" | "RULES";
      model: string | null;
      created_at: Date;
    }[]
  >`
    select details, method, model, created_at from audit_log
    where bank_id = ${bankId} and event_type = 'BRIEFING_GENERATED'
    order by created_at desc limit 1`;
  if (!row?.details?.briefing) return null;
  const [m] = await sql<{ updated: Date | null }[]>`
    select max(metrics_updated_at) as updated from issues where bank_id = ${bankId}`;
  return {
    briefing: row.details.briefing,
    method: row.method,
    model: row.model,
    generatedAt: row.created_at,
    stale: Boolean(m?.updated && m.updated > row.created_at),
    issueLinks: await issueLinks(bankId),
    note: row.details.note ?? null,
  };
}
