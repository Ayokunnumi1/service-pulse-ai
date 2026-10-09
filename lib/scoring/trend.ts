import type { TrendStatus } from "@/lib/constants";

/**
 * Deterministic early-warning engine. Growth is always computed by the
 * application — never by the AI.
 */

/** Minimum current-period volume before a brand-new issue is flagged. */
export const NEW_ISSUE_MIN_VOLUME = 5;

export const TREND_THRESHOLDS = [
  { status: "STABLE", label: "0–10%", max: 10 },
  { status: "WATCH", label: "11–30%", max: 30 },
  { status: "EMERGING", label: "31–50%", max: 50 },
  { status: "HIGH_CONCERN", label: "51–100%", max: 100 },
  { status: "CRITICAL", label: "> 100%", max: Infinity },
] as const satisfies ReadonlyArray<{ status: TrendStatus; label: string; max: number }>;

/** Period-over-period growth in percent, or null when there is no baseline. */
export function growthPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Maps growth to a trend status.
 * Declining or flat issues are STABLE. An issue with no previous-period
 * volume is EMERGING once it reaches NEW_ISSUE_MIN_VOLUME complaints.
 */
export function trendStatus(current: number, previous: number): TrendStatus {
  const growth = growthPercent(current, previous);
  if (growth === null) {
    return current >= NEW_ISSUE_MIN_VOLUME ? "EMERGING" : "STABLE";
  }
  // Thresholds are whole-percent bands; round so 10.4% is still "0–10%".
  const g = Math.round(growth);
  const status = TREND_THRESHOLDS.find((band) => g <= band.max)?.status ?? "CRITICAL";
  // Low-volume guard: a jump from 1 to 3 complaints is noise, not an emerging issue.
  if (current < NEW_ISSUE_MIN_VOLUME && status !== "STABLE") return "WATCH";
  return status;
}

export function trendExplanation(current: number, previous: number): string {
  const growth = growthPercent(current, previous);
  if (growth === null) {
    return current >= NEW_ISSUE_MIN_VOLUME
      ? `New issue: ${current} complaints this period with no previous-period baseline.`
      : `Low volume: ${current} complaints this period, no previous-period baseline.`;
  }
  const direction = growth >= 0 ? "up" : "down";
  const lowVolume =
    current < NEW_ISSUE_MIN_VOLUME && growth > 10
      ? ` Capped at Watch: fewer than ${NEW_ISSUE_MIN_VOLUME} complaints.`
      : "";
  return `${current} complaints this period vs ${previous} in the previous period (${direction} ${Math.abs(growth)}%).${lowVolume}`;
}

export const SIGNIFICANT_TRENDS: TrendStatus[] = ["EMERGING", "HIGH_CONCERN", "CRITICAL"];
