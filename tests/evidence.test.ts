import { describe, expect, it } from "vitest";
import { resolveEvidence, rulesEvidence } from "@/lib/ai/evidence";
import type { RootCauseResult } from "@/lib/validation/ai";

const base = (over: Partial<RootCauseResult> = {}): RootCauseResult => ({
  issue_name: "Transfer Processing Failure",
  observed_pattern: "x",
  root_cause: { description: "Likely reconciliation backlog", confidence: 0.8, status: "LIKELY", evidence: [] },
  alternative_causes: [],
  counter_evidence: [],
  affected_systems: [],
  recommended_investigation: [],
  management_insight: "x",
  ...over,
});

const ids = ["id-a", "id-b", "id-c"];

describe("evidence-linked root cause", () => {
  it("resolves cited refs to interaction ids by role", () => {
    const { links, dropped } = resolveEvidence(
      base({
        root_cause: {
          description: "Likely reconciliation backlog",
          confidence: 0.8,
          status: "LIKELY",
          evidence: [
            { ref: "E1", why: "debited, not credited" },
            { ref: "e3", why: "pending for hours" },
          ],
        },
        alternative_causes: [{ description: "Switch outage", likelihood: "POSSIBLE", evidence_refs: ["E2"] }],
        counter_evidence: [{ ref: "E2", why: "different symptom" }],
      }),
      ids,
    );
    expect(dropped).toBe(0);
    expect(links.filter((l) => l.role === "ROOT_CAUSE").map((l) => l.interaction_id)).toEqual(["id-a", "id-c"]);
    expect(links.find((l) => l.role === "ALTERNATIVE")).toMatchObject({ interaction_id: "id-b", alternative_index: 0 });
    expect(links.find((l) => l.role === "COUNTER")).toMatchObject({ interaction_id: "id-b", why: "different symptom" });
  });

  it("drops refs that were never supplied and de-duplicates repeats", () => {
    const { links, dropped } = resolveEvidence(
      base({
        root_cause: {
          description: "Likely reconciliation backlog",
          confidence: 0.8,
          status: "LIKELY",
          evidence: [
            { ref: "E1", why: "a" },
            { ref: "E1", why: "a again" },
            { ref: "E9", why: "invented" },
          ],
        },
      }),
      ids,
    );
    expect(dropped).toBe(1);
    expect(links).toHaveLength(1);
  });

  it("rules fallback cites messages with the most common specific label", () => {
    const links = rulesEvidence(
      [
        { id: "1", issue: "TRANSFER_PENDING" },
        { id: "2", issue: "DEBITED_NOT_CREDITED" },
        { id: "3", issue: "DEBITED_NOT_CREDITED" },
      ],
      "DEBITED_NOT_CREDITED",
    );
    expect(links.map((l) => l.interaction_id)).toEqual(["2", "3"]);
    expect(links.every((l) => l.role === "ROOT_CAUSE")).toBe(true);
  });
});
