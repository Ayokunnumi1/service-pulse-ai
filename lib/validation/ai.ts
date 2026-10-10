import { z } from "zod";
import { CATEGORIES, CHANNELS, INTENTS, PRODUCTS, SENTIMENTS, SEVERITIES } from "@/lib/constants";

/**
 * Structured-output schemas sent to the model (Claude structured outputs).
 * Every field is required, so optional values are modelled as `.nullable()`. Range checks that strict JSON schema cannot
 * express are enforced afterwards by the `Validated*` schemas below.
 */

// ---------------------------------------------------------------------------
// Complaint classification
// ---------------------------------------------------------------------------
export const AIClassificationItemSchema = z.object({
  id: z.string().describe("The id of the interaction exactly as supplied."),
  category: z.enum(CATEGORIES),
  issue: z.string().describe("Specific issue in UPPER_SNAKE_CASE describing this exact message, e.g. FAILED_TRANSFER."),
  issue_group: z
    .string()
    .describe("Normalised issue group code in UPPER_SNAKE_CASE. Prefer a code from the supplied taxonomy."),
  intent: z.enum(INTENTS),
  sentiment: z.enum(SENTIMENTS),
  severity: z.enum(SEVERITIES),
  product: z.enum(PRODUCTS),
  channel: z.enum(CHANNELS),
  location: z.string().nullable().describe("City/branch/location mentioned or supplied; null if unknown."),
  systemic_issue_candidate: z.boolean(),
  confidence: z.number().describe("0 to 1"),
});

export const AIClassificationBatchSchema = z.object({
  results: z.array(AIClassificationItemSchema),
});

const ISSUE_CODE = /^[A-Z][A-Z0-9_]{2,59}$/;

export function normaliseCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export const ValidatedClassificationSchema = AIClassificationItemSchema.extend({
  issue: z.string().transform(normaliseCode).pipe(z.string().regex(ISSUE_CODE)),
  issue_group: z.string().transform(normaliseCode).pipe(z.string().regex(ISSUE_CODE)),
  location: z
    .string()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim().slice(0, 120) : null)),
  confidence: z.number().min(0).max(1),
});
export type ClassificationResult = z.infer<typeof ValidatedClassificationSchema>;

// ---------------------------------------------------------------------------
// Root-cause analysis
// ---------------------------------------------------------------------------
export const ROOT_CAUSE_STATUSES = ["LIKELY", "POSSIBLE", "REQUIRES_INVESTIGATION"] as const;

const EvidenceCitationSchema = z.object({
  ref: z.string().describe("A sample_customer_messages ref, e.g. E3."),
  why: z.string().describe("One short sentence: what in this message points to the conclusion."),
});

export const AIRootCauseSchema = z.object({
  issue_name: z.string(),
  observed_pattern: z.string().describe("What the evidence shows, quoting the supplied figures only."),
  root_cause: z.object({
    description: z.string().describe("Likely root cause — phrased as a hypothesis, never as confirmed fact."),
    confidence: z.number().describe("0 to 1"),
    status: z.enum(ROOT_CAUSE_STATUSES),
    evidence: z.array(EvidenceCitationSchema).describe("2–4 customer messages that support the hypothesis."),
  }),
  alternative_causes: z.array(
    z.object({
      description: z.string(),
      likelihood: z.enum(["POSSIBLE", "LESS_LIKELY"]),
      evidence_refs: z.array(z.string()).describe("0–2 refs of messages that fit this alternative better."),
    }),
  ),
  counter_evidence: z
    .array(EvidenceCitationSchema)
    .describe("0–2 messages that do not fit the likely root cause; [] if all fit."),
  affected_systems: z.array(z.string()),
  recommended_investigation: z.array(z.string()),
  management_insight: z.string().describe("One or two sentences for executives."),
});

export const ValidatedRootCauseSchema = AIRootCauseSchema.extend({
  root_cause: AIRootCauseSchema.shape.root_cause.extend({
    description: z.string().min(5),
    confidence: z.number().min(0).max(1),
    evidence: z.array(EvidenceCitationSchema).max(8),
  }),
  counter_evidence: z.array(EvidenceCitationSchema).max(5),
  alternative_causes: AIRootCauseSchema.shape.alternative_causes.max(5),
  affected_systems: z.array(z.string().min(1)).max(8),
  recommended_investigation: z.array(z.string().min(1)).max(8),
});
export type RootCauseResult = z.infer<typeof ValidatedRootCauseSchema>;

// ---------------------------------------------------------------------------
// Responsible-team recommendation
// ---------------------------------------------------------------------------
export const OWNERSHIP_STATUSES = ["RECOMMENDED", "NO_CLEAR_OWNER"] as const;

export const AITeamRecommendationSchema = z.object({
  ownership_status: z.enum(OWNERSHIP_STATUSES),
  primary_team: z
    .object({
      team_id: z.string().describe("Must be a team_id from the supplied directory."),
      team_name: z.string(),
      department: z.string(),
      confidence: z.number().describe("0 to 1"),
    })
    .nullable(),
  secondary_teams: z.array(
    z.object({
      team_id: z.string().describe("Must be a team_id from the supplied directory."),
      team_name: z.string(),
      reason: z.string(),
    }),
  ),
  reason: z.string().describe("Why this team owns the problem, referencing its listed responsibilities."),
  recommended_action: z.string(),
});

export const ValidatedTeamRecommendationSchema = AITeamRecommendationSchema.extend({
  primary_team: AITeamRecommendationSchema.shape.primary_team
    .unwrap()
    .extend({ confidence: z.number().min(0).max(1) })
    .nullable(),
  secondary_teams: AITeamRecommendationSchema.shape.secondary_teams.max(3),
}).refine((r) => (r.ownership_status === "RECOMMENDED" ? r.primary_team !== null : true), {
  message: "RECOMMENDED requires a primary team",
});
export type TeamRecommendationResult = z.infer<typeof ValidatedTeamRecommendationSchema>;

// ---------------------------------------------------------------------------
// Issue-group consolidation
// ---------------------------------------------------------------------------
export const AIConsolidationSchema = z.object({
  decisions: z.array(
    z.object({
      code: z.string().describe("The candidate group's code exactly as supplied."),
      action: z.enum(["MERGE", "KEEP"]),
      target_code: z.string().nullable().describe("For MERGE: the code of the group to merge into. Null for KEEP."),
      reason: z.string(),
      confidence: z.number().describe("0 to 1"),
    }),
  ),
});
export type ConsolidationDecision = z.infer<typeof AIConsolidationSchema>["decisions"][number];

// ---------------------------------------------------------------------------
// Ask ServicePulse (management assistant)
// ---------------------------------------------------------------------------
export const AIAssistantAnswerSchema = z.object({
  answer: z.string().describe("Direct answer grounded only in the supplied data."),
  key_points: z.array(z.string()).describe("Up to 5 supporting facts, each quoting supplied figures."),
  referenced_issue_codes: z.array(z.string()).describe("issue_code values from the data that the answer relies on."),
  data_limitations: z.string().nullable().describe("What the supplied data cannot answer, or null."),
});
export type AssistantAnswer = z.infer<typeof AIAssistantAnswerSchema>;
