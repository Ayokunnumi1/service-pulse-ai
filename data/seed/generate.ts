import { CHANNELS, PRODUCT_LABELS, type Channel } from "@/lib/constants";
import { MERCHANTS, RECIPIENT_BANKS, SCENARIOS, type Scenario } from "./messages";
import type { SeedBank, SeedBranch } from "./organisation";

/**
 * Deterministic synthetic interaction generator. Week 0 is the oldest week,
 * week 7 is the current 7-day period ending at the anchor time.
 */

export const WEEKS = 8;
const DAY = 24 * 3600 * 1000;

interface VolumePlan {
  scenario: keyof typeof SCENARIOS;
  weekly: number[] | number; // explicit per-week counts, or a base with ±20% jitter
  hotspots?: { branchCodes: string[]; currentWeekShare: number };
}

export const VOLUME_PLANS: Record<string, VolumePlan[]> = {
  "kestrel-trust": [
    { scenario: "transfer", weekly: [22, 24, 23, 26, 28, 30, 40, 58] }, // +45% → Emerging
    { scenario: "mobileAuth", weekly: [8, 9, 7, 10, 9, 11, 14, 36] }, // +157% → Critical
    { scenario: "cardPayment", weekly: [10, 12, 11, 13, 12, 14, 18, 30] }, // +67% → High concern
    {
      scenario: "atm",
      weekly: [12, 13, 12, 14, 13, 15, 17, 21], // +24% → Watch
      hotspots: { branchCodes: ["LAG-IKJ", "ABJ-WUS"], currentWeekShare: 0.6 },
    },
    {
      scenario: "branchDelay",
      weekly: [10, 11, 10, 12, 11, 12, 14, 19], // +36% → Emerging
      hotspots: { branchCodes: ["LAG-LEK", "PHC-TAM"], currentWeekShare: 0.65 },
    },
    { scenario: "ussd", weekly: 5 },
    { scenario: "charges", weekly: 6 },
    { scenario: "fraud", weekly: 2 },
    { scenario: "statement", weekly: 8 },
    { scenario: "accountUpdate", weekly: 7 },
    { scenario: "cardRequest", weekly: 6 },
    { scenario: "loan", weekly: 6 },
    { scenario: "feedback", weekly: 6 },
  ],
  harbourline: [
    { scenario: "ussd", weekly: [3, 4, 3, 4, 5, 4, 6, 14] }, // +133% → Critical
    { scenario: "transfer", weekly: [6, 7, 6, 7, 6, 7, 8, 8] }, // 0% → Stable
    { scenario: "cardPayment", weekly: [3, 3, 4, 3, 4, 3, 4, 5] }, // +25% → Watch
    { scenario: "atm", weekly: [2, 2, 3, 2, 3, 2, 3, 3] },
    {
      scenario: "branchDelay",
      weekly: [2, 3, 2, 3, 2, 3, 3, 6], // +100% → High concern
      hotspots: { branchCodes: ["HB-SUR"], currentWeekShare: 0.7 },
    },
    { scenario: "mobileAuth", weekly: 1 },
    { scenario: "charges", weekly: 2 },
    { scenario: "statement", weekly: 3 },
    { scenario: "accountUpdate", weekly: 2 },
    { scenario: "loan", weekly: 2 },
    { scenario: "feedback", weekly: 2 },
  ],
};

export interface GeneratedInteraction {
  /** Scenario the message was generated from — ground truth for evaluation, never stored or shown to the classifier. */
  scenario: string;
  channel: Channel;
  message: string;
  customer_reference: string;
  branch: string | null;
  location: string | null;
  product: string | null;
  amount: number | null;
  occurred_at: Date;
}

/** mulberry32 — small, fast, deterministic PRNG. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    weighted: <T extends string>(weights: Partial<Record<T, number>>): T => {
      const entries = Object.entries(weights) as [T, number][];
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [k, w] of entries) {
        r -= w;
        if (r <= 0) return k;
      }
      return entries[entries.length - 1]![0];
    },
  };
}
type Rng = ReturnType<typeof createRng>;

function formatNaira(n: number): string {
  return `₦${n.toLocaleString("en-NG")}`;
}

function roundAmount(n: number): number {
  if (n >= 10_000) return Math.round(n / 500) * 500;
  if (n >= 1_000) return Math.round(n / 50) * 50;
  return Math.round(n / 10) * 10;
}

function weeklyCounts(plan: VolumePlan, rng: Rng): number[] {
  if (Array.isArray(plan.weekly)) return plan.weekly;
  const base = plan.weekly;
  return Array.from({ length: WEEKS }, () => Math.max(0, base + Math.round((rng.next() - 0.5) * base * 0.4)));
}

function pickBranch(bank: SeedBank, plan: VolumePlan, week: number, rng: Rng): SeedBranch {
  if (plan.hotspots && week === WEEKS - 1 && rng.next() < plan.hotspots.currentWeekShare) {
    const code = rng.pick(plan.hotspots.branchCodes);
    const hot = bank.branches.find((b) => b.code === code);
    if (hot) return hot;
  }
  return rng.pick(bank.branches);
}

/** Business-hours-weighted timestamp within the given week. */
function timestampInWeek(anchor: Date, week: number, rng: Rng): Date {
  const weekEnd = anchor.getTime() - (WEEKS - 1 - week) * 7 * DAY;
  const weekStart = weekEnd - 7 * DAY;
  // Leave a small margin at both edges so the week a record belongs to is unambiguous.
  const margin = 3 * 3600 * 1000;
  const raw = new Date(weekStart + margin + rng.next() * (7 * DAY - 2 * margin));
  if (rng.next() < 0.85) {
    // Shift into business hours when that keeps the timestamp inside its week.
    const shifted = new Date(raw);
    shifted.setHours(rng.int(8, 19), rng.int(0, 59), rng.int(0, 59), 0);
    if (shifted.getTime() > weekStart + margin && shifted.getTime() < weekEnd - margin) return shifted;
  }
  return raw;
}

function fillTemplate(
  template: string,
  ctx: { bank: SeedBank; branch: SeedBranch; amount: number | null; rng: Rng },
): string {
  const { bank, branch, amount, rng } = ctx;
  return template
    .replaceAll("{amount}", formatNaira(amount ?? roundAmount(rng.int(2_000, 50_000))))
    .replaceAll("{brand}", bank.brand)
    .replaceAll("{handle}", bank.handle)
    .replaceAll("{hours}", String(rng.int(2, 9)))
    .replaceAll("{days}", String(rng.int(2, 4)))
    .replaceAll("{minutes}", String(rng.pick([45, 60, 75, 90, 120, 150])))
    .replaceAll("{recipientBank}", rng.pick(RECIPIENT_BANKS))
    .replaceAll("{merchant}", rng.pick(MERCHANTS))
    .replaceAll("{branch}", branch.name)
    .replaceAll("{city}", rng.pick(bank.branches).city);
}

const BRANCH_BOUND_SCENARIOS = new Set(["atm", "branchDelay", "cardRequest"]);

function generateOne(
  bank: SeedBank,
  plan: VolumePlan,
  scenario: Scenario,
  week: number,
  anchor: Date,
  rng: Rng,
): GeneratedInteraction {
  const channel = rng.weighted(scenario.channels) as Channel;
  const branch = pickBranch(bank, plan, week, rng);
  const template = rng.pick(scenario.templates);

  let amount: number | null = null;
  if (scenario.amountRange && (template.includes("{amount}") || rng.next() < 0.6)) {
    amount = roundAmount(rng.int(scenario.amountRange[0], scenario.amountRange[1]));
  }

  const branchBound = channel === "BRANCH" || BRANCH_BOUND_SCENARIOS.has(scenario.key);
  const product =
    scenario.products.length > 0 && rng.next() < 0.65 ? PRODUCT_LABELS[rng.pick(scenario.products)] : null;

  return {
    scenario: scenario.key,
    channel: CHANNELS.includes(channel) ? channel : "WEB",
    message: fillTemplate(template, { bank, branch, amount, rng }),
    customer_reference: `CUS-${String(rng.int(1_000_000, 9_999_999))}`,
    branch: branchBound ? branch.name : null,
    location: branchBound ? branch.city : rng.next() < 0.8 ? rng.pick(bank.branches).city : null,
    product,
    amount,
    occurred_at: timestampInWeek(anchor, week, rng),
  };
}

export function generateInteractions(bank: SeedBank, anchor: Date, seed = 20261009): GeneratedInteraction[] {
  const plans = VOLUME_PLANS[bank.slug] ?? [];
  const rng = createRng(seed + bank.slug.length * 7919);
  const out: GeneratedInteraction[] = [];
  for (const plan of plans) {
    const scenario = SCENARIOS[plan.scenario];
    if (!scenario) continue;
    weeklyCounts(plan, rng).forEach((count, week) => {
      for (let i = 0; i < count; i++) out.push(generateOne(bank, plan, scenario, week, anchor, rng));
    });
  }
  return out.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());
}
