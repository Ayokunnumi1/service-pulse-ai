import "server-only";
import { randomBytes } from "node:crypto";
import { type Channel, type ProductCode, PRODUCT_LABELS } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import { writeAudit } from "@/lib/db/audit";
import { createRng } from "@/data/seed/generate";
import { SEED_BANKS } from "@/data/seed/organisation";
import type { Bank } from "@/types";
import { SIMULATION_REF_PREFIX, type IncidentScenarioKey } from "./scenarios";

/**
 * Synthesises a burst of customer complaints describing one operational
 * incident, timestamped inside the current analysis period, so the full
 * pipeline (classification → normalisation → trend detection → root cause →
 * team recommendation) can be demonstrated live.
 *
 * Tokens: {amount} {brand} {handle} {city} {merchant} {hours}
 */

interface IncidentTemplate {
  channels: Partial<Record<Channel, number>>;
  products: ProductCode[];
  amountRange?: [number, number];
  templates: string[];
}

const INCIDENTS: Record<IncidentScenarioKey, IncidentTemplate> = {
  salary_credit: {
    channels: { CONTACT_CENTER: 30, MOBILE_APP: 20, SOCIAL_MEDIA: 20, WHATSAPP: 15, BRANCH: 10, EMAIL: 5 },
    products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
    amountRange: [85_000, 950_000],
    templates: [
      "My salary has not been credited. HR says the company paid since Friday.",
      "Our payroll was sent through {brand} but nobody in my office has received salary.",
      "{handle} it's month end and my salary of {amount} is nowhere. Employer has proof of payment!",
      "Una never credit my salary since. Oga for office talk say dem don pay. Abeg wetin dey happen?",
      "Employer confirmed the bulk payment left their account but my account still shows nothing.",
      "Pls my salry no show for acct, company say e don go since morning",
      "I have rent to pay and my {amount} salary is stuck somewhere between my company and your bank.",
      "Customer reports salary credit not received; employer's batch payment reference provided, debit confirmed on corporate account.",
      "Why is it only {brand} customers in my company that have not been paid? Other banks received theirs hours ago.",
      "Salary still pending for {hours} hours. This is affecting all my colleagues too.",
      "My salary alert never came but my employer says the payroll file was processed successfully.",
      "{handle} whole office waiting for salary, only those banking with you haven't been credited. Explain!",
      "Expected my monthly pay of {amount} today. Nothing. Company account was debited.",
      "Is there a problem with bulk transfers? My wife's salary and mine are both missing.",
    ],
  },
  duplicate_debit: {
    channels: { MOBILE_APP: 30, SOCIAL_MEDIA: 25, CONTACT_CENTER: 25, WHATSAPP: 10, EMAIL: 10 },
    products: ["DEBIT_CARD", "CREDIT_CARD"],
    amountRange: [3_500, 180_000],
    templates: [
      "I paid {amount} at {merchant} and I was debited twice.",
      "Double debit on my card for one POS transaction at {merchant}.",
      "{handle} you charged my card two times for the same {amount} purchase. Refund me now!",
      "Card payment of {amount} online, two debit alerts came. Merchant only got one.",
      "Una cut my money two times for one payment o. {amount} x2. Abeg reverse am.",
      "My statement shows the same card transaction twice today at {merchant}.",
      "Customer disputes duplicate card debit of {amount}; single purchase confirmed by merchant.",
      "Every card payment I made today was charged twice. What is going on with your cards?",
      "Paid for fuel {amount}, got debited twice within one minute. Same terminal.",
      "Twice debited for one transaction!! This is the third person in my family it happened to today.",
      "Duplicate charge on my debit card — {amount} deducted two times for a single order.",
    ],
  },
  app_crash: {
    channels: { MOBILE_APP: 50, SOCIAL_MEDIA: 25, CONTACT_CENTER: 15, EMAIL: 10 },
    products: ["MOBILE_BANKING"],
    templates: [
      "The app closes immediately after I open it since yesterday's update.",
      "{brand} app keeps crashing when I tap on Transfers.",
      "{handle} your new app version crashes on my Android every single time. Please fix.",
      "App shuts down as soon as the dashboard loads. Reinstalled, same thing.",
      "E no dey open at all. I click am, e just close by itself. Since the update.",
      "Updated the app this morning and now it freezes then exits when I try to pay bills.",
      "iPhone user here — app crashes on launch after the latest update.",
      "Customer reports mobile app terminating unexpectedly on launch following update; cleared cache, issue persists.",
      "Can't use the app at all, it crashes after the splash screen. Need to make urgent payments.",
      "The app was fine until the update. Now it crashes whenever I open my account statement.",
      "Ap keep crashing, pls wat is happening",
    ],
  },
};

const MERCHANTS = ["ShopRite", "FreshCart", "Total filling station", "Jumia", "Chicken Republic", "Market Square"];

/** Deterministic-ish id for one simulation run (shows in the customer reference). */
function newBatchId(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString("en-NG")}`;
}

export interface SimulationResult {
  batchId: string;
  interactionIds: string[];
  periodEnd: Date;
}

/**
 * Inserts `count` PENDING complaints for the scenario. Timestamps are spread
 * over the 30 hours before the bank's latest interaction (so the current
 * period does not shift), with ~60% concentrated in one hotspot city.
 */
export async function simulateIncident(
  bank: Bank,
  scenario: IncidentScenarioKey,
  count: number,
  actor: string,
): Promise<SimulationResult> {
  const def = INCIDENTS[scenario];
  const seedBank = SEED_BANKS.find((b) => b.slug === bank.slug);
  const brand = seedBank?.brand ?? bank.name.split(" ")[0] ?? bank.name;
  const handle = seedBank?.handle ?? `@${bank.name.replace(/\s+/g, "")}`;

  const [branches, [latest]] = await Promise.all([
    sql<{ name: string; city: string }[]>`select name, city from branches where bank_id = ${bank.id} order by code`,
    sql<{ at: Date | null }[]>`select max(occurred_at) as at from interactions where bank_id = ${bank.id}`,
  ]);
  const periodEnd = latest?.at ?? new Date();
  const batchId = newBatchId();
  const rng = createRng(Number.parseInt(batchId, 16));
  const hotspot = branches.length ? rng.pick(branches) : null;

  const records = Array.from({ length: count }, (_, i) => {
    const channel = rng.weighted(def.channels) as Channel;
    const atHotspot = hotspot && rng.next() < 0.6;
    const branch = atHotspot ? hotspot : branches.length ? rng.pick(branches) : null;
    const amount = def.amountRange ? Math.round(rng.int(def.amountRange[0], def.amountRange[1]) / 500) * 500 : null;
    const message = rng
      .pick(def.templates)
      .replaceAll("{amount}", formatNaira(amount ?? 0))
      .replaceAll("{brand}", brand)
      .replaceAll("{handle}", handle)
      .replaceAll("{city}", branch?.city ?? "Lagos")
      .replaceAll("{merchant}", rng.pick(MERCHANTS))
      .replaceAll("{hours}", String(rng.int(3, 12)));
    // Spread across the 30 hours before periodEnd, never after it.
    const occurredAt = new Date(periodEnd.getTime() - Math.round(rng.next() * 30 * 3600 * 1000));
    return {
      bank_id: bank.id,
      channel,
      message,
      customer_reference: `${SIMULATION_REF_PREFIX}${batchId}-${String(i + 1).padStart(2, "0")}`,
      branch: channel === "BRANCH" ? (branch?.name ?? null) : null,
      location: branch?.city ?? null,
      product: rng.next() < 0.7 ? PRODUCT_LABELS[rng.pick(def.products)] : null,
      amount: def.amountRange && message.includes("₦") ? amount : null,
      occurred_at: occurredAt,
      status: "PENDING",
      source: "IMPORT",
    };
  });

  const inserted = await sql<{ id: string }[]>`insert into interactions ${sql(records)} returning id`;

  await writeAudit({
    bankId: bank.id,
    eventType: "INCIDENT_SIMULATED",
    actor,
    inputData: { scenario, count, batch_id: batchId },
    details: { inserted: inserted.length, hotspot: hotspot?.city ?? null },
  });

  return { batchId, interactionIds: inserted.map((r) => r.id), periodEnd };
}

export interface LocatedIssue {
  id: string;
  issue_code: string;
  title: string;
  count: number;
  trend_status: string;
  risk_level: string;
  risk_score: number;
}

/** Issue groups the simulated complaints were normalised into, largest first. */
export async function locateSimulatedIssues(bankId: string, interactionIds: string[]): Promise<LocatedIssue[]> {
  return sql<LocatedIssue[]>`
    select s.id, s.issue_code, s.title, count(*)::int as count, s.trend_status, s.risk_level, s.risk_score
    from interaction_classifications c
    join issues s on s.bank_id = c.bank_id and s.issue_code = c.issue_group
    where c.bank_id = ${bankId} and c.interaction_id = any(${interactionIds}) and c.intent = 'COMPLAINT'
    group by s.id
    order by count desc`;
}

/** Removes every simulated interaction (and its classification) for the bank. */
export async function clearSimulatedIncidents(bankId: string, actor: string): Promise<number> {
  const removed = await sql<{ id: string }[]>`
    delete from interactions
    where bank_id = ${bankId} and customer_reference like ${`${SIMULATION_REF_PREFIX}%`}
    returning id`;
  if (removed.length > 0) {
    await writeAudit({
      bankId,
      eventType: "SIMULATION_CLEARED",
      actor,
      details: { removed: removed.length },
    });
  }
  return removed.length;
}

export async function countSimulatedInteractions(bankId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from interactions
    where bank_id = ${bankId} and customer_reference like ${`${SIMULATION_REF_PREFIX}%`}`;
  return row?.n ?? 0;
}
