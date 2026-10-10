import type { RootCauseResult } from "@/lib/validation/ai";
import type { IssueEvidence } from "@/prompts/root-cause-analysis";

/**
 * Deterministic root-cause hypotheses per issue group, used when the AI is
 * unavailable. These are always framed as hypotheses requiring investigation.
 */

export interface RootCauseTemplate {
  likely: string;
  confidence: number;
  alternatives: string[];
  systems: string[];
  investigation: string[];
  action: string;
  /** Weighted regexes matched against team responsibility text. */
  ownerKeywords: [RegExp, number][];
}

export const ROOT_CAUSE_LIBRARY: Record<string, RootCauseTemplate> = {
  TRANSFER_PROCESSING_FAILURE: {
    likely: "Likely backend transaction-processing / reconciliation problem causing debits without matching credits.",
    confidence: 0.7,
    alternatives: [
      "Possible latency or timeouts on the interbank transfer gateway.",
      "Possible delayed posting or reversal batch on the core ledger.",
    ],
    systems: ["Transaction Processing API", "Interbank Transfer Gateway", "Reconciliation Engine"],
    investigation: [
      "Review error and timeout rates on the transaction-processing service for the current period.",
      "Extract transfers debited but not credited and confirm their status with the interbank switch.",
      "Check the reversal / reconciliation job logs for failures or backlog.",
    ],
    action:
      "Investigate the transaction-processing service and reconcile pending or failed transfers; reverse confirmed failures.",
    ownerKeywords: [
      [/transaction processing/, 3],
      [/interbank/, 3],
      [/transfer/, 2],
      [/revers/, 2],
      [/reconciliation/, 2],
      [/\bapis?\b/, 1],
      [/backend/, 1],
      [/posting/, 1],
      [/settlement/, 1],
      [/exception/, 1],
    ],
  },
  MOBILE_APP_AUTHENTICATION: {
    likely:
      "Likely defect in the mobile app login / authentication flow, possibly linked to a recent app release or OTP delivery.",
    confidence: 0.65,
    alternatives: [
      "Possible OTP / SMS delivery degradation at the messaging provider.",
      "Possible device-binding service errors after customers change devices.",
    ],
    systems: ["Mobile Banking App", "Authentication & OTP Service"],
    investigation: [
      "Compare login failure rates by app version and OS for the current period.",
      "Check OTP delivery success rates and latency with the SMS provider.",
      "Review authentication-service error logs for session or device-binding errors.",
    ],
    action:
      "Investigate mobile authentication failures by app version and verify OTP delivery; prepare a hotfix or rollback if a release is implicated.",
    ownerKeywords: [
      [/mobile authentication/, 4],
      [/authentication/, 2],
      [/login/, 2],
      [/\botp\b/, 2],
      [/biometric/, 2],
      [/device binding/, 2],
      [/mobile|android|ios/, 1],
      [/token/, 1],
      [/identity/, 1],
    ],
  },
  CARD_PAYMENT_FAILURE: {
    likely: "Likely card authorisation failures on the card payment switch / gateway.",
    confidence: 0.6,
    alternatives: [
      'Possible issuer-side connectivity problems ("issuer unavailable").',
      "Possible incorrect card limits or card-status settings after a configuration change.",
    ],
    systems: ["Card Payment Switch", "Card Management System"],
    investigation: [
      "Analyse decline codes for the current period by merchant type and channel (POS vs online).",
      "Check switch / gateway availability and timeouts.",
      "Identify debited-but-declined transactions for reversal.",
    ],
    action:
      "Investigate card authorisation declines on the payment switch and reverse debited-but-declined transactions.",
    ownerKeywords: [
      [/\bpos\b/, 3],
      [/card payment/, 3],
      [/card transaction/, 3],
      [/merchant/, 2],
      [/payment gateway/, 2],
      [/online card/, 2],
      [/chargeback|dispute/, 1],
    ],
  },
  ATM_WITHDRAWAL_FAILURE: {
    likely: "Likely ATM dispense faults or connectivity problems concentrated at specific ATM locations.",
    confidence: 0.6,
    alternatives: [
      "Possible cash-out or replenishment delays at the affected sites.",
      "Possible network connectivity drops between ATMs and the switch.",
    ],
    systems: ["ATM Network Controller", "Reconciliation Engine"],
    investigation: [
      "Rank ATMs by dispense-error count for the current period and inspect the top sites.",
      "Check ATM connectivity and journal logs for failed dispenses with debits.",
      "Reconcile ATM journals to auto-refund dispense errors.",
    ],
    action: "Inspect the most-affected ATMs, fix dispense/connectivity faults and refund confirmed dispense errors.",
    ownerKeywords: [
      [/\batm\b/, 2],
      [/cash dispensing/, 2],
      [/card retention/, 2],
      [/dispens/, 1],
      [/cash reconciliation/, 1],
      [/refund/, 1],
    ],
  },
  BRANCH_SERVICE_DELAY: {
    likely: "Likely branch staffing or capacity shortfall at specific branches during peak hours.",
    confidence: 0.55,
    alternatives: [
      "Possible slow core-banking response times at branch counters.",
      "Possible queue-management system faults.",
    ],
    systems: ["Branch Queue Management System"],
    investigation: [
      "Compare teller staffing and open counters with customer footfall at the most-affected branches.",
      "Review queue-management wait-time reports for the current period.",
      "Check whether branch staff reported slow system response times.",
    ],
    action: "Review staffing and counter availability at the most-affected branches and rebalance peak-hour capacity.",
    ownerKeywords: [
      [/queue/, 3],
      [/branch staffing/, 3],
      [/teller/, 2],
      [/branch service/, 2],
      [/branch/, 1],
    ],
  },
  USSD_SERVICE_FAILURE: {
    likely: "Likely USSD gateway or telco-integration instability causing session timeouts.",
    confidence: 0.6,
    alternatives: [
      "Possible telco network degradation outside the bank's control.",
      "Possible slow backend responses causing USSD sessions to expire.",
    ],
    systems: ["USSD Gateway"],
    investigation: [
      "Check USSD session success and timeout rates by telco for the current period.",
      "Review backend response times for USSD transactions.",
      "Confirm with telco partners whether there were network incidents.",
    ],
    action: "Investigate USSD session timeouts with the gateway and telco partners and reduce backend response times.",
    ownerKeywords: [
      [/ussd/, 4],
      [/telco/, 2],
      [/digital channel/, 1],
    ],
  },
  SUSPECTED_FRAUD: {
    likely: "Possible account-takeover or social-engineering activity requiring urgent investigation.",
    confidence: 0.5,
    alternatives: [
      "Possible card compromise at a merchant.",
      "Possible customer-initiated transactions later disputed.",
    ],
    systems: ["Authentication & OTP Service"],
    investigation: [
      "Review affected accounts for suspicious logins and device changes.",
      "Check whether the reports share a common merchant, device or pattern.",
    ],
    action: "Escalate to fraud monitoring, secure affected accounts and contact customers.",
    ownerKeywords: [
      [/fraud/, 4],
      [/account compromise/, 3],
      [/security/, 1],
      [/\botp\b/, 1],
    ],
  },
  UNAUTHORISED_CHARGES: {
    likely: "Possible fee-configuration change or unclear fee communication.",
    confidence: 0.45,
    alternatives: ["Possible duplicate fee postings."],
    systems: ["Core Banking Ledger"],
    investigation: [
      "Check for recent fee-configuration changes.",
      "Sample affected accounts for duplicate or unexpected fee postings.",
    ],
    action: "Review recent fee configuration and customer communication about charges.",
    ownerKeywords: [[/\bfees?\b|charges|billing|pricing/, 3]],
  },
};

export const GENERIC_ROOT_CAUSE: Omit<RootCauseTemplate, "ownerKeywords"> = {
  likely: "Root cause not yet determined — requires investigation.",
  confidence: 0.3,
  alternatives: [],
  systems: [],
  investigation: [
    "Review a sample of the customer messages to confirm the common underlying problem.",
    "Identify the system or process involved and its owning team.",
  ],
  action: "Review the complaints, confirm the affected system or process and assign an owner.",
};

export function rootCauseWithRules(evidence: IssueEvidence): RootCauseResult {
  const t = ROOT_CAUSE_LIBRARY[evidence.issue_code];
  const m = evidence.metrics;
  const topChannel = evidence.affected_channels[0];
  const topLocation = evidence.affected_locations[0];
  const growth =
    m.growth_pct === null
      ? "with no previous-period baseline"
      : `${m.growth_pct >= 0 ? "up" : "down"} ${Math.abs(m.growth_pct)}% on the previous period (${m.previous_period_complaints})`;
  const pattern =
    `${m.current_period_complaints} complaints in the last ${evidence.period_days} days, ${growth}.` +
    (topChannel ? ` Most reported via ${topChannel.name} (${topChannel.pct}%).` : "") +
    (topLocation ? ` Most affected location: ${topLocation.name} (${topLocation.pct}%).` : "");

  const template = t ?? GENERIC_ROOT_CAUSE;
  return {
    issue_name: evidence.issue_title,
    observed_pattern: pattern,
    root_cause: {
      description: template.likely,
      confidence: template.confidence,
      status: t ? "LIKELY" : "REQUIRES_INVESTIGATION",
    },
    alternative_causes: template.alternatives.map((description) => ({ description, likelihood: "POSSIBLE" as const })),
    affected_systems: template.systems.filter(
      (s) => evidence.known_systems.length === 0 || evidence.known_systems.some((k) => k.name === s),
    ),
    recommended_investigation: template.investigation,
    management_insight: `${evidence.issue_title} is ${m.trend_status.replace("_", " ").toLowerCase()} with ${m.risk_level.toLowerCase()} risk (${m.risk_score}/100). ${template.action}`,
  };
}

export function recommendedActionFor(issueCode: string): string {
  return (ROOT_CAUSE_LIBRARY[issueCode] ?? GENERIC_ROOT_CAUSE).action;
}
