import { generateInteractions } from "./generate";
import { SEED_BANKS } from "./organisation";

/**
 * Ground truth for the synthetic demo data. Each seeded message is generated
 * from a scenario whose underlying issue group is known; the scenario is
 * never stored or shown to the classifier. Generation is deterministic
 * (seeded PRNG, and RNG consumption does not depend on the seeding date), so
 * the labels can be rebuilt at any time and matched to stored rows by
 * customer reference + message text.
 */
export const SCENARIO_ISSUE_GROUP: Record<string, string> = {
  transfer: "TRANSFER_PROCESSING_FAILURE",
  mobileAuth: "MOBILE_APP_AUTHENTICATION",
  cardPayment: "CARD_PAYMENT_FAILURE",
  atm: "ATM_WITHDRAWAL_FAILURE",
  branchDelay: "BRANCH_SERVICE_DELAY",
  ussd: "USSD_SERVICE_FAILURE",
  charges: "UNAUTHORISED_CHARGES",
  fraud: "SUSPECTED_FRAUD",
  statement: "ACCOUNT_STATEMENT_REQUEST",
  accountUpdate: "ACCOUNT_UPDATE_REQUEST",
  cardRequest: "CARD_REQUEST",
  loan: "LOAN_ENQUIRY",
  feedback: "GENERAL_FEEDBACK",
};

export const truthKey = (customerReference: string | null, message: string) =>
  `${customerReference ?? ""}\u0000${message}`;

const cache = new Map<string, Map<string, string>>();

/** Expected issue group per seeded message for a demo bank, or null if the bank is not seeded. */
export function groundTruthFor(bankSlug: string): Map<string, string> | null {
  const cached = cache.get(bankSlug);
  if (cached) return cached;
  const bank = SEED_BANKS.find((b) => b.slug === bankSlug);
  if (!bank) return null;
  const truth = new Map<string, string>();
  for (const i of generateInteractions(bank, new Date(0))) {
    const expected = SCENARIO_ISSUE_GROUP[i.scenario];
    if (expected) truth.set(truthKey(i.customer_reference, i.message), expected);
  }
  cache.set(bankSlug, truth);
  return truth;
}
