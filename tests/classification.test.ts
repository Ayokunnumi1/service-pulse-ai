import { describe, expect, it } from "vitest";
import { classifyWithRules } from "@/lib/ai/rules/classifier";
import { SCENARIOS } from "@/data/seed/messages";
import { generateInteractions } from "@/data/seed/generate";
import { KESTREL } from "@/data/seed/organisation";
import { AIClassificationItemSchema, ValidatedClassificationSchema } from "@/lib/validation/ai";

const EXPECTED_GROUP: Record<string, string> = {
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

function fill(t: string) {
  return t
    .replaceAll("{amount}", "₦25,000")
    .replaceAll("{brand}", "Kestrel")
    .replaceAll("{handle}", "@KestrelTrustNG")
    .replaceAll("{hours}", "4")
    .replaceAll("{days}", "3")
    .replaceAll("{minutes}", "90")
    .replaceAll("{recipientBank}", "Opal Bank")
    .replaceAll("{merchant}", "Mega Mart")
    .replaceAll("{branch}", "Lekki Phase 1")
    .replaceAll("{city}", "Lagos");
}

describe("issue normalisation (rules fallback)", () => {
  it("maps the spec's transfer variations to TRANSFER_PROCESSING_FAILURE", () => {
    for (const message of [
      "Money was deducted.",
      "Recipient hasn't received the transfer.",
      "Transfer is still pending.",
      "My transfer failed.",
    ]) {
      const r = classifyWithRules({
        channel: "MOBILE_APP",
        message,
        product: null,
        location: null,
        branch: null,
        amount: null,
      });
      expect(r.issue_group, message).toBe("TRANSFER_PROCESSING_FAILURE");
    }
  });

  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    it(`normalises every "${key}" phrasing to ${EXPECTED_GROUP[key]}`, () => {
      for (const template of scenario.templates) {
        const message = fill(template);
        const r = classifyWithRules({
          channel: "WEB",
          message,
          product: null,
          location: null,
          branch: null,
          amount: null,
        });
        expect(r.issue_group, message).toBe(EXPECTED_GROUP[key]);
      }
    });
  }

  it("flags systemic candidates only for complaints in systemic groups", () => {
    const complaint = classifyWithRules({
      channel: "USSD",
      message: "Transfer failed.",
      product: null,
      location: null,
      branch: null,
      amount: null,
    });
    const request = classifyWithRules({
      channel: "EMAIL",
      message: "Please send my account statement.",
      product: null,
      location: null,
      branch: null,
      amount: null,
    });
    expect(complaint.systemic_issue_candidate).toBe(true);
    expect(complaint.intent).toBe("COMPLAINT");
    expect(request.systemic_issue_candidate).toBe(false);
    expect(request.intent).toBe("REQUEST");
  });

  it("produces output that passes the same Zod validation as AI output", () => {
    const r = classifyWithRules({
      channel: "ATM" as never,
      message: "ATM swallowed my card",
      product: null,
      location: "Lagos",
      branch: null,
      amount: null,
    });
    expect(ValidatedClassificationSchema.safeParse({ ...r, id: "x", channel: "BRANCH" }).success).toBe(true);
  });
});

describe("AI output validation", () => {
  const good = {
    id: "m1",
    category: "TRANSFER",
    issue: "failed transfer",
    issue_group: "transfer processing failure",
    intent: "COMPLAINT",
    sentiment: "NEGATIVE",
    severity: "HIGH",
    product: "MOBILE_BANKING",
    channel: "MOBILE_APP",
    location: " Lagos ",
    systemic_issue_candidate: true,
    confidence: 0.92,
  };

  it("normalises codes to UPPER_SNAKE_CASE", () => {
    const r = ValidatedClassificationSchema.parse(good);
    expect(r.issue_group).toBe("TRANSFER_PROCESSING_FAILURE");
    expect(r.issue).toBe("FAILED_TRANSFER");
    expect(r.location).toBe("Lagos");
  });

  it("rejects out-of-range confidence and unknown enums", () => {
    expect(ValidatedClassificationSchema.safeParse({ ...good, confidence: 1.7 }).success).toBe(false);
    expect(AIClassificationItemSchema.safeParse({ ...good, severity: "EXTREME" }).success).toBe(false);
    expect(AIClassificationItemSchema.safeParse({ ...good, product: "CRYPTO" }).success).toBe(false);
  });
});

describe("synthetic seed data", () => {
  it("generates at least 1,000 interactions deterministically", () => {
    const anchor = new Date("2026-10-09T12:00:00Z");
    const a = generateInteractions(KESTREL, anchor);
    const b = generateInteractions(KESTREL, anchor);
    expect(a.length).toBeGreaterThanOrEqual(1000);
    expect(a.map((x) => x.message)).toEqual(b.map((x) => x.message));
    expect(a.every((x) => x.occurred_at.getTime() <= anchor.getTime())).toBe(true);
  });
});
