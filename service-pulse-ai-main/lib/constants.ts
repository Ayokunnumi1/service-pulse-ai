/**
 * Shared domain vocabulary. Safe to import from client and server code.
 */

export const CHANNELS = [
  "BRANCH",
  "CONTACT_CENTER",
  "EMAIL",
  "MOBILE_APP",
  "USSD",
  "WHATSAPP",
  "SOCIAL_MEDIA",
  "WEB",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  BRANCH: "Branch",
  CONTACT_CENTER: "Contact Centre",
  EMAIL: "Email",
  MOBILE_APP: "Mobile App",
  USSD: "USSD",
  WHATSAPP: "WhatsApp",
  SOCIAL_MEDIA: "Social Media",
  WEB: "Web",
};

export const CATEGORIES = [
  "TRANSFER",
  "DIGITAL_ACCESS",
  "CARD",
  "ATM",
  "BRANCH_SERVICE",
  "FEES_CHARGES",
  "ACCOUNT_SERVICES",
  "LOANS",
  "SECURITY",
  "GENERAL",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  TRANSFER: "Transfers",
  DIGITAL_ACCESS: "Digital access",
  CARD: "Cards",
  ATM: "ATM",
  BRANCH_SERVICE: "Branch service",
  FEES_CHARGES: "Fees & charges",
  ACCOUNT_SERVICES: "Account services",
  LOANS: "Loans",
  SECURITY: "Security & fraud",
  GENERAL: "General",
};

export const INTENTS = ["COMPLAINT", "ENQUIRY", "REQUEST", "COMPLIMENT"] as const;
export type Intent = (typeof INTENTS)[number];

export const SENTIMENTS = ["VERY_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const PRODUCTS = [
  "MOBILE_BANKING",
  "INTERNET_BANKING",
  "USSD_BANKING",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "ATM",
  "SAVINGS_ACCOUNT",
  "CURRENT_ACCOUNT",
  "LOANS",
  "BRANCH_SERVICES",
  "OTHER",
] as const;
export type ProductCode = (typeof PRODUCTS)[number];

export const PRODUCT_LABELS: Record<ProductCode, string> = {
  MOBILE_BANKING: "Mobile Banking",
  INTERNET_BANKING: "Internet Banking",
  USSD_BANKING: "USSD Banking",
  DEBIT_CARD: "Debit Card",
  CREDIT_CARD: "Credit Card",
  ATM: "ATM",
  SAVINGS_ACCOUNT: "Savings Account",
  CURRENT_ACCOUNT: "Current Account",
  LOANS: "Loans",
  BRANCH_SERVICES: "Branch Services",
  OTHER: "Other",
};

export const INTERACTION_STATUSES = ["PENDING", "CLASSIFIED", "FAILED"] as const;
export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

export const ISSUE_STATUSES = ["OPEN", "ASSIGNED", "INVESTIGATING", "RESOLVED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const TREND_STATUSES = ["STABLE", "WATCH", "EMERGING", "HIGH_CONCERN", "CRITICAL"] as const;
export type TrendStatus = (typeof TREND_STATUSES)[number];

export const TREND_LABELS: Record<TrendStatus, string> = {
  STABLE: "Stable",
  WATCH: "Watch",
  EMERGING: "Emerging",
  HIGH_CONCERN: "High concern",
  CRITICAL: "Critical",
};

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Canonical issue groups. The AI normalises differently-worded customer
 * messages into these groups; it may propose a new UPPER_SNAKE_CASE group
 * only when none of these fits.
 */
export interface IssueGroupDefinition {
  code: string;
  title: string;
  category: Category;
  description: string;
  systemic: boolean;
}

export const ISSUE_GROUPS: IssueGroupDefinition[] = [
  {
    code: "TRANSFER_PROCESSING_FAILURE",
    title: "Transfer Processing Failure",
    category: "TRANSFER",
    description: "Transfers that fail, stay pending, are debited but not credited to the recipient, or need reversal.",
    systemic: true,
  },
  {
    code: "MOBILE_APP_AUTHENTICATION",
    title: "Mobile App Authentication",
    category: "DIGITAL_ACCESS",
    description:
      "Customers unable to log in to the mobile app: OTP not received, biometrics/PIN rejected, device binding or session errors, account locked after login attempts.",
    systemic: true,
  },
  {
    code: "CARD_PAYMENT_FAILURE",
    title: "Card Payment Failure",
    category: "CARD",
    description: "Card declined at POS or online merchants, card payments debited without value, failed web payments.",
    systemic: true,
  },
  {
    code: "ATM_WITHDRAWAL_FAILURE",
    title: "ATM Withdrawal Failure",
    category: "ATM",
    description:
      "ATM dispensed no cash but account debited, ATM out of service, card retained by ATM, partial dispense.",
    systemic: true,
  },
  {
    code: "BRANCH_SERVICE_DELAY",
    title: "Branch Service Delay",
    category: "BRANCH_SERVICE",
    description: "Long queues, slow tellers, few counters open, long waits for branch services.",
    systemic: true,
  },
  {
    code: "USSD_SERVICE_FAILURE",
    title: "USSD Service Failure",
    category: "DIGITAL_ACCESS",
    description: "USSD sessions timing out, USSD code not responding, USSD menu errors.",
    systemic: true,
  },
  {
    code: "UNAUTHORISED_CHARGES",
    title: "Unexpected Fees & Charges",
    category: "FEES_CHARGES",
    description: "Customers disputing fees, unexpected deductions, SMS or maintenance charges.",
    systemic: false,
  },
  {
    code: "SUSPECTED_FRAUD",
    title: "Suspected Fraud",
    category: "SECURITY",
    description: "Unrecognised transactions, phishing attempts, suspected account compromise.",
    systemic: false,
  },
  {
    code: "ACCOUNT_STATEMENT_REQUEST",
    title: "Account Statement Request",
    category: "ACCOUNT_SERVICES",
    description: "Requests for account statements or reference letters.",
    systemic: false,
  },
  {
    code: "ACCOUNT_UPDATE_REQUEST",
    title: "Account / KYC Update",
    category: "ACCOUNT_SERVICES",
    description: "Requests to update phone number, address, BVN/KYC details or account information.",
    systemic: false,
  },
  {
    code: "CARD_REQUEST",
    title: "Card Request",
    category: "CARD",
    description: "Requests for new, replacement or renewed cards.",
    systemic: false,
  },
  {
    code: "LOAN_ENQUIRY",
    title: "Loan Enquiry",
    category: "LOANS",
    description: "Questions about loan eligibility, rates, repayment or loan status.",
    systemic: false,
  },
  {
    code: "GENERAL_FEEDBACK",
    title: "General Feedback",
    category: "GENERAL",
    description: "Compliments, general feedback and messages without a specific problem.",
    systemic: false,
  },
];

export const ISSUE_GROUP_BY_CODE = new Map(ISSUE_GROUPS.map((g) => [g.code, g]));

export function issueTitle(code: string): string {
  return (
    ISSUE_GROUP_BY_CODE.get(code)?.title ??
    code
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const BANK_COOKIE = "sp_bank";
export const NO_CLEAR_OWNER = "NO_CLEAR_OWNER";
