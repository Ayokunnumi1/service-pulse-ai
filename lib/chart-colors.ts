/**
 * Colour follows the entity, never its rank: each canonical issue group owns
 * a fixed categorical slot, so a series keeps its colour on every chart.
 */
const ISSUE_SLOTS: Record<string, number> = {
  TRANSFER_PROCESSING_FAILURE: 1,
  MOBILE_APP_AUTHENTICATION: 2,
  CARD_PAYMENT_FAILURE: 3,
  ATM_WITHDRAWAL_FAILURE: 4,
  BRANCH_SERVICE_DELAY: 5,
  USSD_SERVICE_FAILURE: 6,
  UNAUTHORISED_CHARGES: 7,
  SUSPECTED_FRAUD: 8,
};

export const OTHER_COLOR = "var(--series-other)";

export function issueColor(code: string): string {
  const slot = ISSUE_SLOTS[code];
  return slot ? `var(--series-${slot})` : OTHER_COLOR;
}
