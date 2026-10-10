import type { RootCauseResult } from "@/lib/validation/ai";

/**
 * Evidence-linked root cause: the model cites sample messages by short ref
 * (E1, E2, …). Every ref is validated against the messages actually supplied
 * and resolved to its interaction id; invalid or duplicate refs are dropped
 * and reported. Message text is never copied — it is read from the
 * interaction when displayed.
 */

export type EvidenceRole = "ROOT_CAUSE" | "ALTERNATIVE" | "COUNTER";

export interface EvidenceLink {
  interaction_id: string;
  role: EvidenceRole;
  alternative_index: number | null;
  why: string | null;
}

export const evidenceRef = (index: number) => `E${index + 1}`;

const MAX_PER_ROLE = 4;

export function resolveEvidence(
  rootCause: RootCauseResult,
  sampleIds: string[],
): { links: EvidenceLink[]; dropped: number } {
  const byRef = new Map(sampleIds.map((id, i) => [evidenceRef(i), id]));
  const links: EvidenceLink[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  const add = (ref: string, role: EvidenceRole, why: string | null, alternativeIndex: number | null = null) => {
    const id = byRef.get(ref.trim().toUpperCase());
    const key = `${role}:${alternativeIndex ?? ""}:${id}`;
    if (!id) {
      dropped++;
      return;
    }
    if (seen.has(key)) return;
    if (links.filter((l) => l.role === role && l.alternative_index === alternativeIndex).length >= MAX_PER_ROLE) return;
    seen.add(key);
    links.push({ interaction_id: id, role, alternative_index: alternativeIndex, why: why?.trim() || null });
  };

  for (const e of rootCause.root_cause.evidence) add(e.ref, "ROOT_CAUSE", e.why);
  rootCause.alternative_causes.forEach((alt, i) => {
    for (const ref of alt.evidence_refs) add(ref, "ALTERNATIVE", null, i);
  });
  for (const e of rootCause.counter_evidence) add(e.ref, "COUNTER", e.why);

  return { links, dropped };
}

/**
 * Rules fallback: cite up to three messages carrying the most common specific
 * issue label, so even a deterministic hypothesis points at real complaints.
 */
export function rulesEvidence(signals: { id: string; issue: string }[], topLabel: string | null): EvidenceLink[] {
  const matching = topLabel ? signals.filter((s) => s.issue === topLabel) : [];
  return (matching.length ? matching : signals).slice(0, 3).map((s) => ({
    interaction_id: s.id,
    role: "ROOT_CAUSE" as const,
    alternative_index: null,
    why: `Example of the most common specific problem in this issue (${s.issue}).`,
  }));
}
