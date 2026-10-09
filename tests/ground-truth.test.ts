import { describe, expect, it } from "vitest";
import { generateInteractions } from "@/data/seed/generate";
import { groundTruthFor, SCENARIO_ISSUE_GROUP, truthKey } from "@/data/seed/ground-truth";
import { SCENARIOS } from "@/data/seed/messages";
import { SEED_BANKS } from "@/data/seed/organisation";
import { ISSUE_GROUP_BY_CODE } from "@/lib/constants";

describe("seed ground truth", () => {
  it("labels every scenario with a known issue group", () => {
    for (const key of Object.keys(SCENARIOS)) {
      expect(SCENARIO_ISSUE_GROUP[key], key).toBeDefined();
      expect(ISSUE_GROUP_BY_CODE.has(SCENARIO_ISSUE_GROUP[key]!), key).toBe(true);
    }
  });

  it("regenerates identical messages regardless of the seeding date", () => {
    for (const bank of SEED_BANKS) {
      const a = generateInteractions(bank, new Date("2026-10-09T12:00:00Z"));
      const b = generateInteractions(bank, new Date("2027-03-01T08:30:00Z"));
      const keys = (xs: typeof a) => xs.map((i) => truthKey(i.customer_reference, i.message)).sort();
      expect(keys(a)).toEqual(keys(b));
    }
  });

  it("has an unambiguous label for (almost) every seeded message", () => {
    for (const bank of SEED_BANKS) {
      const generated = generateInteractions(bank, new Date());
      const truth = groundTruthFor(bank.slug)!;
      // Keys collide only if the same customer reference sends the same text twice.
      expect(truth.size).toBeGreaterThan(generated.length * 0.99);
    }
  });
});

describe("challenge set", () => {
  it("covers every seeded issue group with unique ids", async () => {
    const { CHALLENGE_SET } = await import("@/data/evaluation/challenge-set");
    expect(new Set(CHALLENGE_SET.map((c) => c.id)).size).toBe(CHALLENGE_SET.length);
    const groups = new Set(CHALLENGE_SET.map((c) => c.expected));
    for (const g of Object.values(SCENARIO_ISSUE_GROUP)) expect(groups.has(g), g).toBe(true);
  });
});
