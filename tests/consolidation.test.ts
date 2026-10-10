import { describe, expect, it } from "vitest";
import { isCandidateGroup, resolveTarget } from "@/lib/ai/consolidate";

describe("issue-group consolidation", () => {
  it("treats only non-taxonomy groups as merge candidates", () => {
    expect(isCandidateGroup("SALARY_NOT_CREDITED")).toBe(true);
    expect(isCandidateGroup("TRANSFER_PROCESSING_FAILURE")).toBe(false);
    expect(isCandidateGroup("UNCATEGORISED")).toBe(false);
  });

  it("follows merge chains to the final group", () => {
    const map = new Map([
      ["SALARY_DELAY", "SALARY_NOT_CREDITED"],
      ["SALARY_NOT_CREDITED", "TRANSFER_PROCESSING_FAILURE"],
    ]);
    expect(resolveTarget("SALARY_DELAY", map)).toBe("TRANSFER_PROCESSING_FAILURE");
    expect(resolveTarget("SALARY_NOT_CREDITED", map)).toBe("TRANSFER_PROCESSING_FAILURE");
    expect(resolveTarget("UNKNOWN", map)).toBeNull();
  });

  it("rejects loops and self-merges", () => {
    expect(
      resolveTarget(
        "A_GROUP",
        new Map([
          ["A_GROUP", "B_GROUP"],
          ["B_GROUP", "A_GROUP"],
        ]),
      ),
    ).toBeNull();
    expect(resolveTarget("A_GROUP", new Map([["A_GROUP", "A_GROUP"]]))).toBeNull();
  });
});
