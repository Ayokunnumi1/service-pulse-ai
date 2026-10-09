import Papa from "papaparse";
import { z } from "zod";
import { CHANNELS, type Channel } from "@/lib/constants";
import { cleanOptional, sanitizeText } from "@/lib/utils/sanitize";

/** Maximum rows accepted in a single import request. */
export const MAX_IMPORT_ROWS = 5000;

const CHANNEL_ALIASES: Record<string, Channel> = {
  CONTACT_CENTRE: "CONTACT_CENTER",
  CALL_CENTER: "CONTACT_CENTER",
  CALL_CENTRE: "CONTACT_CENTER",
  PHONE: "CONTACT_CENTER",
  MOBILE: "MOBILE_APP",
  APP: "MOBILE_APP",
  MOBILE_BANKING: "MOBILE_APP",
  TWITTER: "SOCIAL_MEDIA",
  X: "SOCIAL_MEDIA",
  FACEBOOK: "SOCIAL_MEDIA",
  INSTAGRAM: "SOCIAL_MEDIA",
  SOCIAL: "SOCIAL_MEDIA",
  WEBSITE: "WEB",
  INTERNET_BANKING: "WEB",
  WHATSAPP_BANKING: "WHATSAPP",
  IN_BRANCH: "BRANCH",
};

export function normaliseChannel(value: string): string {
  const key = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return CHANNEL_ALIASES[key] ?? key;
}

const optionalText = (max: number) =>
  z
    .unknown()
    .optional()
    .transform((v) => cleanOptional(v, max));

export const ImportRowSchema = z.object({
  channel: z
    .string({ error: "channel is required" })
    .transform(normaliseChannel)
    .pipe(z.enum(CHANNELS, { error: `channel must be one of ${CHANNELS.join(", ")}` })),
  message: z
    .string({ error: "message is required" })
    .transform((m) => sanitizeText(m))
    .pipe(z.string().min(3, "message is too short")),
  customer_reference: optionalText(64),
  branch: optionalText(120),
  location: optionalText(120),
  product: optionalText(80),
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "amount must be a non-negative number" });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  timestamp: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return new Date();
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "timestamp is not a valid date" });
        return z.NEVER;
      }
      if (d.getTime() > Date.now() + 24 * 3600 * 1000) {
        ctx.addIssue({ code: "custom", message: "timestamp is in the future" });
        return z.NEVER;
      }
      return d;
    }),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;

export interface ImportParseResult {
  rows: ImportRow[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

/** Parses raw CSV or JSON text into raw records (no validation). */
export function parseRawRecords(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (format === "json") {
    const data: unknown = JSON.parse(content);
    const list = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as { interactions?: unknown }).interactions)
        ? (data as { interactions: unknown[] }).interactions
        : null;
    if (!list) throw new Error('JSON must be an array of interactions or { "interactions": [...] }');
    return list.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  }
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(`CSV could not be parsed: ${parsed.errors[0]?.message}`);
  }
  return parsed.data;
}

export function validateImportRecords(records: Record<string, unknown>[]): ImportParseResult {
  const rows: ImportRow[] = [];
  const errors: { row: number; message: string }[] = [];
  records.slice(0, MAX_IMPORT_ROWS).forEach((record, index) => {
    const result = ImportRowSchema.safeParse(record);
    if (result.success) {
      rows.push(result.data);
    } else {
      errors.push({
        row: index + 1,
        message: result.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; "),
      });
    }
  });
  if (records.length > MAX_IMPORT_ROWS) {
    errors.push({
      row: MAX_IMPORT_ROWS + 1,
      message: `Only the first ${MAX_IMPORT_ROWS} rows are imported per request.`,
    });
  }
  return { rows, errors, totalRows: records.length };
}
