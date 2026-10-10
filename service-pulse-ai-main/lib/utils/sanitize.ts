/**
 * Customer content handling.
 *  - sanitizeText: applied on ingestion — strips markup/control characters.
 *  - redactPII: applied before any text leaves the server (AI prompts, audit
 *    snapshots) — masks card numbers, account numbers, phone numbers, emails.
 * React escapes all rendered text, so no HTML is ever injected into the UI.
 */

export const MAX_MESSAGE_LENGTH = 2000;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-z][^>]*>/gi;

export function sanitizeText(input: string, maxLength = MAX_MESSAGE_LENGTH): string {
  return input
    .normalize("NFKC")
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAGS, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 13–19 digit card numbers, optionally grouped by spaces or dashes.
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
// International (+234…) or local (0…) phone numbers.
const PHONE = /(?:\+\d{1,3}[ -]?)?\b0?[789]\d{2}[ -]?\d{3}[ -]?\d{4}\b/g;
// 10-digit account numbers (NUBAN).
const ACCOUNT = /\b\d{10}\b/g;

export function redactPII(input: string): string {
  return input
    .replace(EMAIL, "[EMAIL]")
    .replace(CARD, (m) => (m.replace(/\D/g, "").length >= 13 ? "[CARD]" : m))
    .replace(PHONE, "[PHONE]")
    .replace(ACCOUNT, "[ACCOUNT]");
}

/** Prepares customer text for inclusion in an AI prompt. */
export function forAI(input: string, maxLength = 600): string {
  return redactPII(sanitizeText(input, maxLength));
}

/** Trims an optional free-text field; empty strings become null. */
export function cleanOptional(value: unknown, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const s = sanitizeText(String(value), maxLength);
  return s.length > 0 ? s : null;
}
