import { describe, expect, it } from "vitest";
import { computeRisk, riskLevel, severityFromAverage } from "@/lib/scoring/risk";
import { growthPercent, trendStatus } from "@/lib/scoring/trend";

describe("early-warning trend engine", () => {
  it("computes growth deterministically (spec example 400 → 580 = +45%)", () => {
    expect(growthPercent(580, 400)).toBe(45);
    expect(trendStatus(580, 400)).toBe("EMERGING");
  });

  it.each([
    [105, 100, "STABLE"], // 5%
    [110, 100, "STABLE"], // 10%
    [111, 100, "WATCH"], // 11%
    [130, 100, "WATCH"],
    [131, 100, "EMERGING"],
    [150, 100, "EMERGING"],
    [151, 100, "HIGH_CONCERN"],
    [200, 100, "HIGH_CONCERN"], // exactly 100%
    [201, 100, "CRITICAL"],
    [60, 100, "STABLE"], // declining
  ])("current %i vs previous %i → %s", (cur, prev, expected) => {
    expect(trendStatus(cur, prev)).toBe(expected);
  });

  it("treats a new issue with enough volume as emerging, low volume as stable", () => {
    expect(growthPercent(12, 0)).toBeNull();
    expect(trendStatus(12, 0)).toBe("EMERGING");
    expect(trendStatus(2, 0)).toBe("STABLE");
  });

  it("caps tiny-volume spikes at WATCH", () => {
    expect(trendStatus(3, 1)).toBe("WATCH"); // +200% but only 3 complaints
  });
});

describe("risk prioritisation", () => {
  const base = {
    currentCount: 58,
    totalCurrentComplaints: 177,
    trend: "EMERGING" as const,
    growthPct: 45,
    severityCounts: { HIGH: 40, CRITICAL: 18 },
    negativeCount: 58,
    veryNegativeCount: 7,
    channelCount: 4,
    locationCount: 8,
    financialImpact: 9_900_000,
  };

  it("scores on 0..100 and explains every factor", () => {
    const r = computeRisk(base);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.factors).toHaveLength(7);
    expect(r.factors.every((f) => f.detail.length > 0)).toBe(true);
    expect(Math.round(r.factors.reduce((s, f) => s + f.points, 0))).toBe(r.score);
  });

  it("excludes financial impact when no amounts are available and re-normalises", () => {
    const r = computeRisk({ ...base, financialImpact: null });
    const fin = r.factors.find((f) => f.key === "financial")!;
    expect(fin.available).toBe(false);
    expect(fin.points).toBe(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("is monotonic in growth", () => {
    const stable = computeRisk({ ...base, trend: "STABLE" }).score;
    const critical = computeRisk({ ...base, trend: "CRITICAL" }).score;
    expect(critical).toBeGreaterThan(stable);
  });

  it("maps scores to levels", () => {
    expect(riskLevel(80)).toBe("CRITICAL");
    expect(riskLevel(60)).toBe("HIGH");
    expect(riskLevel(40)).toBe("MEDIUM");
    expect(riskLevel(10)).toBe("LOW");
    expect(severityFromAverage(3.6)).toBe("CRITICAL");
    expect(severityFromAverage(1.2)).toBe("LOW");
  });
});
