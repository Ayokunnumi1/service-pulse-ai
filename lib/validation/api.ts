import { z } from "zod";
import { ISSUE_STATUSES, PRODUCTS } from "@/lib/constants";
import { INCIDENT_SCENARIO_KEYS } from "@/lib/simulation/scenarios";

/** Request-body schemas for every mutating API route. */

export const uuid = z.uuid();

export const SelectBankSchema = z.object({ bankId: uuid });

export const ImportRequestSchema = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(1).max(5_000_000),
});

export const ClassifyRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).default(60),
});

export const ReclassifyRequestSchema = z.object({
  scope: z.enum(["RULES", "ALL"]).default("RULES"),
});

export const SimulateIncidentSchema = z.object({
  scenario: z.enum(INCIDENT_SCENARIO_KEYS),
  count: z.number().int().min(10).max(40).default(28),
});

export const LocateSimulationSchema = z.object({
  interactionIds: z.array(uuid).min(1).max(100),
});

export const AssignIssueSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("accept"),
    analysisId: uuid,
    actor: z.string().trim().min(1).max(80).default("Demo User"),
  }),
  z.object({
    mode: z.literal("override"),
    teamId: uuid,
    reason: z.string().trim().min(3, "Please give a reason for overriding").max(1000),
    actor: z.string().trim().min(1).max(80).default("Demo User"),
  }),
]);

export const IssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
  actor: z.string().trim().min(1).max(80).default("Demo User"),
});

export const IssueNoteSchema = z.object({
  note: z.string().trim().min(1).max(4000),
  author: z.string().trim().min(1).max(80).default("Demo User"),
});

export const AssistantRequestSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

export const CreateTeamSchema = z.object({
  departmentId: uuid,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

export const AddResponsibilitySchema = z.object({
  responsibility: z.string().trim().min(2).max(200),
});

export const SetTeamProductsSchema = z.object({
  productCodes: z.array(z.enum(PRODUCTS)).max(PRODUCTS.length),
});

/** Formats a ZodError into a short message safe to return to the client. */
export function zodMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}
