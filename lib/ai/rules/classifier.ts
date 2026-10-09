import {
  ISSUE_GROUP_BY_CODE,
  PRODUCT_LABELS,
  SEVERITIES,
  type Category,
  type Channel,
  type Intent,
  type ProductCode,
  type Sentiment,
  type Severity,
} from "@/lib/constants";
import type { ClassificationResult } from "@/lib/validation/ai";

/**
 * Deterministic fallback classifier, used only when the AI is unavailable
 * (no API key, timeout, invalid output). It scores weighted phrase patterns
 * per issue group. Results are labelled method = "RULES" everywhere.
 */

interface GroupRule {
  code: string;
  intent: Intent;
  baseSeverity: Severity;
  patterns: [RegExp, number][];
  specific: [RegExp, string][]; // first match → specific issue label
  defaultIssue: string;
  product: (channel: Channel) => ProductCode;
}

const RULES: GroupRule[] = [
  {
    code: "SUSPECTED_FRAUD",
    intent: "COMPLAINT",
    baseSeverity: "CRITICAL",
    patterns: [
      [/did not make|never made|compromis|pretending|block my account|unrecogni[sz]ed|fraud|scam|phishing/i, 4],
    ],
    specific: [[/pretending|otp/i, "SOCIAL_ENGINEERING_ATTEMPT"]],
    defaultIssue: "UNRECOGNISED_TRANSACTION",
    product: () => "CURRENT_ACCOUNT",
  },
  {
    code: "TRANSFER_PROCESSING_FAILURE",
    intent: "COMPLAINT",
    baseSeverity: "HIGH",
    patterns: [
      [/\btransf|\btransfr\b/i, 3],
      [/recipient|beneficiar|vendor/i, 2],
      [/not (been )?credited|wasn'?t credited|never (got|receive)|no get credit|no alert|nothing came in/i, 2],
      [/pending|hanging|hangin|processing/i, 2],
      [/sent .{0,30}to|sending money|send money/i, 2],
      [/revers/i, 1],
      [/deduct|debited|\bdebit\b/i, 1],
    ],
    specific: [
      [/twice/i, "DUPLICATE_DEBIT"],
      [/pending|hanging|hangin|processing/i, "TRANSFER_PENDING"],
      [
        /not (been )?credited|wasn'?t credited|(has ?n[o']t|not) (yet )?received|never (got|receive)|no get credit|no alert|nothing came in|deduct/i,
        "DEBITED_NOT_CREDITED",
      ],
      [/revers/i, "REVERSAL_REQUEST"],
    ],
    defaultIssue: "FAILED_TRANSFER",
    product: (c) => (c === "USSD" ? "USSD_BANKING" : c === "BRANCH" ? "CURRENT_ACCOUNT" : "MOBILE_BANKING"),
  },
  {
    code: "MOBILE_APP_AUTHENTICATION",
    intent: "COMPLAINT",
    baseSeverity: "MEDIUM",
    patterns: [
      [/log ?in|sign ?in|logs me out|locked (me )?out/i, 3],
      [/device (not recogni[sz]ed|binding)|verify device/i, 3],
      [/\botp\b|activation code|token/i, 2],
      [/invalid credentials|session expired|authenticat/i, 2],
      [/fingerprint|face id|biometric|\bpin\b/i, 1],
      [/\bapp\b/i, 1],
    ],
    specific: [
      [/\botp\b|activation code|token/i, "OTP_NOT_RECEIVED"],
      [/device/i, "DEVICE_BINDING_ERROR"],
      [/fingerprint|face id|biometric/i, "BIOMETRIC_LOGIN_FAILURE"],
      [/locked|blocked/i, "ACCOUNT_LOCKED"],
    ],
    defaultIssue: "LOGIN_FAILURE",
    product: () => "MOBILE_BANKING",
  },
  {
    code: "CARD_PAYMENT_FAILURE",
    intent: "COMPLAINT",
    baseSeverity: "MEDIUM",
    patterns: [
      [/\bpos\b|terminal|checkout|merchant|online payment|card payment|subscription/i, 3],
      [/declin|do not honou?r|issuer unavailable|error 91|reject/i, 3],
      [/payment (failed|declined)|payment that did not go through/i, 2],
      [/\bcard\b/i, 1],
      [/fuel|supermarket|attendant/i, 1],
    ],
    specific: [
      [/declin|do not honou?r|issuer unavailable|error 91|reject/i, "CARD_DECLINED"],
      [/debited|charged/i, "DEBITED_FAILED_PAYMENT"],
    ],
    defaultIssue: "CARD_PAYMENT_ERROR",
    product: () => "DEBIT_CARD",
  },
  {
    code: "ATM_WITHDRAWAL_FAILURE",
    intent: "COMPLAINT",
    baseSeverity: "HIGH",
    patterns: [
      [/\batms?\b|machine|dispens|\bcash\b/i, 3],
      [/swallow|retain/i, 3],
      [/withdr/i, 2],
      [/out of service/i, 1],
    ],
    specific: [
      [/swallow|retain/i, "CARD_RETAINED"],
      [/out of service|none is working/i, "ATM_OUT_OF_SERVICE"],
      [/part of/i, "PARTIAL_DISPENSE"],
    ],
    defaultIssue: "CASH_NOT_DISPENSED",
    product: () => "ATM",
  },
  {
    code: "BRANCH_SERVICE_DELAY",
    intent: "COMPLAINT",
    baseSeverity: "LOW",
    patterns: [
      [/queue|line since|stand for line|waited|wait(ing)? (times?|for)|teller|counters?|banking hall/i, 3],
      [/slow|lunch break|didn'?t move/i, 2],
      [/branch/i, 1],
    ],
    specific: [[/teller|counters?/i, "INSUFFICIENT_TELLERS"]],
    defaultIssue: "LONG_QUEUE",
    product: () => "BRANCH_SERVICES",
  },
  {
    code: "USSD_SERVICE_FAILURE",
    intent: "COMPLAINT",
    baseSeverity: "MEDIUM",
    patterns: [
      [/ussd|\bmmi\b|\*\d+#/i, 4],
      [/\bdial(ed)?\b/i, 3],
      [/session (expired|ended|drops)|timing out|freezes/i, 2],
    ],
    specific: [[/timing out|session/i, "USSD_SESSION_TIMEOUT"]],
    defaultIssue: "USSD_UNAVAILABLE",
    product: () => "USSD_BANKING",
  },
  {
    code: "UNAUTHORISED_CHARGES",
    intent: "COMPLAINT",
    baseSeverity: "LOW",
    patterns: [
      [/charg|\bfees?\b|maintenance/i, 3],
      [/deduction/i, 3],
      [/unknown|unexplained|never told/i, 2],
      [/sms alert/i, 2],
    ],
    specific: [[/sms/i, "SMS_ALERT_CHARGES"]],
    defaultIssue: "UNEXPECTED_FEE",
    product: () => "SAVINGS_ACCOUNT",
  },
  {
    code: "ACCOUNT_STATEMENT_REQUEST",
    intent: "REQUEST",
    baseSeverity: "LOW",
    patterns: [[/statement|reference letter/i, 4]],
    specific: [],
    defaultIssue: "STATEMENT_REQUEST",
    product: () => "CURRENT_ACCOUNT",
  },
  {
    code: "CARD_REQUEST",
    intent: "REQUEST",
    baseSeverity: "LOW",
    patterns: [[/new debit card|replacement card|renewed card|request a new|has expired/i, 4]],
    specific: [],
    defaultIssue: "CARD_REPLACEMENT_REQUEST",
    product: () => "DEBIT_CARD",
  },
  {
    code: "ACCOUNT_UPDATE_REQUEST",
    intent: "REQUEST",
    baseSeverity: "LOW",
    patterns: [[/\bupdate\b|change the email|\bbvn\b|phone number|address/i, 3]],
    specific: [[/bvn/i, "BVN_LINKING"]],
    defaultIssue: "PROFILE_UPDATE",
    product: () => "SAVINGS_ACCOUNT",
  },
  {
    code: "LOAN_ENQUIRY",
    intent: "ENQUIRY",
    baseSeverity: "LOW",
    patterns: [[/loan|salary advance|interest rate|repay/i, 4]],
    specific: [[/approved|status/i, "LOAN_STATUS"]],
    defaultIssue: "LOAN_PRODUCT_ENQUIRY",
    product: () => "LOANS",
  },
  {
    code: "GENERAL_FEEDBACK",
    intent: "COMPLIMENT",
    baseSeverity: "LOW",
    patterns: [[/thank|well done|great job|smooth|excellent|really nice/i, 4]],
    specific: [],
    defaultIssue: "COMPLIMENT",
    product: () => "OTHER",
  },
];

const VERY_NEGATIVE = /!{2,}|\?{2,}|unacceptable|terrible|embarrass|frustrat|what kind of bank|asap|immediately|na wa/i;
const ESCALATORS = /twice|\d+ days|since yesterday|third time|every time|\bmultiple\b/i;

export interface RulesInput {
  channel: Channel;
  message: string;
  product: string | null;
  location: string | null;
  branch: string | null;
  amount: number | null;
}

function productFromHint(hint: string | null): ProductCode | null {
  if (!hint) return null;
  const h = hint.trim().toLowerCase();
  for (const [code, label] of Object.entries(PRODUCT_LABELS) as [ProductCode, string][]) {
    if (label.toLowerCase() === h || code.toLowerCase() === h.replace(/\s+/g, "_")) return code;
  }
  return null;
}

function bump(severity: Severity): Severity {
  const i = SEVERITIES.indexOf(severity);
  return SEVERITIES[Math.min(i + 1, SEVERITIES.length - 1)] as Severity;
}

export function classifyWithRules(input: RulesInput): Omit<ClassificationResult, "id"> {
  const text = input.message;
  const scored = RULES.map((rule) => ({
    rule,
    score: rule.patterns.reduce((s, [re, w]) => (re.test(text) ? s + w : s), 0),
  })).sort((a, b) => b.score - a.score); // stable sort keeps RULES priority order on ties

  const best = scored[0]!;
  const second = scored[1]!;
  const matched = best.score > 0;
  const rule = matched ? best.rule : null;

  const intent: Intent = rule?.intent ?? "ENQUIRY";
  let sentiment: Sentiment;
  if (intent === "COMPLIMENT") sentiment = "POSITIVE";
  else if (intent !== "COMPLAINT") sentiment = "NEUTRAL";
  else sentiment = VERY_NEGATIVE.test(text) || /[A-Z]{6,}/.test(text) ? "VERY_NEGATIVE" : "NEGATIVE";

  let severity: Severity = rule?.baseSeverity ?? "LOW";
  if (
    intent === "COMPLAINT" &&
    (sentiment === "VERY_NEGATIVE" || (input.amount ?? 0) >= 200_000 || ESCALATORS.test(text))
  ) {
    severity = bump(severity);
  }

  const group = rule ? ISSUE_GROUP_BY_CODE.get(rule.code) : undefined;
  const category: Category = group?.category ?? "GENERAL";
  const specific = rule?.specific.find(([re]) => re.test(text))?.[1] ?? rule?.defaultIssue ?? "UNCATEGORISED";
  const margin = best.score - second.score;
  const confidence = matched ? Math.min(0.88, 0.45 + best.score * 0.04 + Math.min(margin, 4) * 0.03) : 0.3;

  return {
    category,
    issue: specific,
    issue_group: rule?.code ?? "UNCATEGORISED",
    intent,
    sentiment,
    severity,
    product: productFromHint(input.product) ?? rule?.product(input.channel) ?? "OTHER",
    channel: input.channel,
    location: input.location ?? null,
    systemic_issue_candidate: Boolean(group?.systemic) && intent === "COMPLAINT",
    confidence: Math.round(confidence * 100) / 100,
  };
}
