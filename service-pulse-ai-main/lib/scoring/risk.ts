import { SEVERITY_WEIGHT, type RiskLevel, type Severity, type TrendStatus } from "@/lib/constants";

/**
 * Deterministic risk prioritisation. Each factor is normalised to 0..1 and
 * weighted; factors without data (e.g. no financial amounts) are excluded and
 * the remaining weights are re-normalised so the score stays on 0..100.
 */

export interface RiskInput {
  currentCount: number;
  totalCurrentComplaints: number; // all complaints in the bank for the current period
  trend: TrendStatus;
  growthPct: number | null;
  severityCounts: Partial<Record<Severity, number>>;
  negativeCount: number; // NEGATIVE + VERY_NEGATIVE in the current period
  veryNegativeCount: number;
  channelCount: number;
  locationCount: number;
  financialImpact: number | null; // sum of reported amounts in the current period
  currency?: string;
}

export interface RiskFactor {
  key: "volume" | "growth" | "severity" | "customer_impact" | "channels" | "locations" | "financial";
  label: string;
  weight: number;
  value: number; // 0..1
  points: number; // contribution to the final 0..100 score
  available: boolean;
  detail: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  summary: string;
}

export const RISK_WEIGHTS = {
  volume: 20,
  growth: 25,
  severity: 20,
  customer_impact: 10,
  channels: 10,
  locations: 5,
  financial: 10,
} as const;

export const RISK_LEVEL_THRESHOLDS: { level: RiskLevel; min: number }[] = [
  { level: "CRITICAL", min: 75 },
  { level: "HIGH", min: 55 },
  { level: "MEDIUM", min: 35 },
  { level: "LOW", min: 0 },
];

/** Share of current-period complaints at which the volume factor maxes out. */
const VOLUME_SHARE_CAP = 0.25;
const CHANNEL_CAP = 4;
const LOCATION_CAP = 5;
/** Reported financial exposure at which the financial factor maxes out. */
const FINANCIAL_CAP = 5_000_000;

const TREND_FACTOR: Record<TrendStatus, number> = {
  STABLE: 0,
  WATCH: 0.35,
  EMERGING: 0.6,
  HIGH_CONCERN: 0.8,
  CRITICAL: 1,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function averageSeverity(counts: Partial<Record<Severity, number>>): number {
  let total = 0;
  let weighted = 0;
  for (const [sev, n] of Object.entries(counts) as [Severity, number][]) {
    total += n;
    weighted += SEVERITY_WEIGHT[sev] * n;
  }
  return total === 0 ? 0 : weighted / total;
}

export function severityFromAverage(avg: number): Severity {
  if (avg >= 3.5) return "CRITICAL";
  if (avg >= 2.5) return "HIGH";
  if (avg >= 1.5) return "MEDIUM";
  return "LOW";
}

export function riskLevel(score: number): RiskLevel {
  return RISK_LEVEL_THRESHOLDS.find((t) => score >= t.min)?.level ?? "LOW";
}

function formatMoney(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function computeRisk(input: RiskInput): RiskResult {
  const share = input.totalCurrentComplaints > 0 ? input.currentCount / input.totalCurrentComplaints : 0;
  const avgSev = averageSeverity(input.severityCounts);
  const impact =
    input.currentCount > 0
      ? clamp01((input.veryNegativeCount + 0.6 * (input.negativeCount - input.veryNegativeCount)) / input.currentCount)
      : 0;
  const hasFinancial = input.financialImpact !== null && input.financialImpact > 0;

  const raw: Omit<RiskFactor, "points">[] = [
    {
      key: "volume",
      label: "Complaint volume",
      weight: RISK_WEIGHTS.volume,
      value: clamp01(share / VOLUME_SHARE_CAP),
      available: true,
      detail: `${input.currentCount} complaints this period (${(share * 100).toFixed(1)}% of all complaints).`,
    },
    {
      key: "growth",
      label: "Growth rate",
      weight: RISK_WEIGHTS.growth,
      value: TREND_FACTOR[input.trend],
      available: true,
      detail:
        input.growthPct === null
          ? `No previous-period baseline; trend classed as ${input.trend.replace("_", " ").toLowerCase()}.`
          : `${input.growthPct > 0 ? "+" : ""}${input.growthPct}% vs previous period (${input.trend.replace("_", " ").toLowerCase()}).`,
    },
    {
      key: "severity",
      label: "Severity",
      weight: RISK_WEIGHTS.severity,
      value: avgSev === 0 ? 0 : clamp01((avgSev - 1) / 3),
      available: true,
      detail:
        avgSev === 0
          ? "No complaints this period."
          : `Average severity ${avgSev.toFixed(2)} / 4 (${severityFromAverage(avgSev).toLowerCase()}).`,
    },
    {
      key: "customer_impact",
      label: "Customer impact",
      weight: RISK_WEIGHTS.customer_impact,
      value: impact,
      available: true,
      detail: `${input.negativeCount} of ${input.currentCount} complaints negative (${input.veryNegativeCount} very negative).`,
    },
    {
      key: "channels",
      label: "Channel spread",
      weight: RISK_WEIGHTS.channels,
      value: clamp01(input.channelCount / CHANNEL_CAP),
      available: true,
      detail: `Reported across ${input.channelCount} channel${input.channelCount === 1 ? "" : "s"}.`,
    },
    {
      key: "locations",
      label: "Location spread",
      weight: RISK_WEIGHTS.locations,
      value: clamp01(input.locationCount / LOCATION_CAP),
      available: true,
      detail: `Reported from ${input.locationCount} location${input.locationCount === 1 ? "" : "s"}.`,
    },
    {
      key: "financial",
      label: "Financial impact",
      weight: RISK_WEIGHTS.financial,
      value: hasFinancial ? clamp01((input.financialImpact as number) / FINANCIAL_CAP) : 0,
      available: hasFinancial,
      detail: hasFinancial
        ? `${formatMoney(input.financialImpact as number, input.currency)} reported in affected transactions this period.`
        : "No transaction amounts reported — factor excluded.",
    },
  ];

  const availableWeight = raw.filter((f) => f.available).reduce((s, f) => s + f.weight, 0);
  const factors: RiskFactor[] = raw.map((f) => ({
    ...f,
    points: f.available ? Math.round(((f.value * f.weight) / availableWeight) * 1000) / 10 : 0,
  }));

  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
  const level = riskLevel(score);
  const top = [...factors]
    .filter((f) => f.available)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((f) => f.label.toLowerCase());

  return {
    score,
    level,
    factors,
    summary: `Risk ${level} (${score}/100), driven mainly by ${top.join(" and ")}.`,
  };
}
