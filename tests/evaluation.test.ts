import { describe, expect, it } from "vitest";
import { summarise, type ItemResult } from "@/lib/evaluation/accuracy";

const item = (id: string, expected: string, rules: string, ai: string | null): ItemResult => ({
  id,
  channel: "WEB",
  message: id,
  expected,
  rules,
  ai,
  aiConfidence: ai ? 0.9 : null,
});

describe("evaluation scoring", () => {
  const report = summarise(
    [
      item("1", "A", "A", "A"),
      item("2", "A", "X", "A"),
      item("3", "B", "X", "Y"),
      item("4", "B", "B", null), // AI unavailable for this item
    ],
    null,
    null,
  );

  it("scores rules on every item and AI only on items it classified", () => {
    expect(report.rules).toEqual({ n: 4, correct: 2, accuracy: 0.5 });
    expect(report.ai.n).toBe(3);
    expect(report.ai.correct).toBe(2);
    expect(report.ai.accuracy).toBeCloseTo(2 / 3);
  });

  it("breaks accuracy down per expected issue group", () => {
    const b = report.groups.find((g) => g.group === "B")!;
    expect(b).toEqual({ group: "B", n: 2, rulesCorrect: 1, aiN: 1, aiCorrect: 0 });
  });
});
