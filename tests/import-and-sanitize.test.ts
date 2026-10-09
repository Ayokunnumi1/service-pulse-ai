import { describe, expect, it } from "vitest";
import { redactPII, sanitizeText } from "@/lib/utils/sanitize";
import { parseRawRecords, validateImportRecords } from "@/lib/validation/import";

describe("CSV / JSON import", () => {
  it("parses CSV with aliases and validates rows", () => {
    const csv = [
      "Channel,Message,Customer Reference,Branch,Location,Product,Amount,Timestamp",
      'Contact Centre,"Transfer pending since yesterday",CUS-1,,Lagos,Mobile Banking,"₦25,000",2026-10-01T10:00:00Z',
      "twitter,App keeps logging me out,,,,,,",
      "FAX,Hello there,,,,,,",
      "WEB,,,,,,,",
    ].join("\n");
    const result = validateImportRecords(parseRawRecords("csv", csv));
    expect(result.totalRows).toBe(4);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ channel: "CONTACT_CENTER", amount: 25000, location: "Lagos" });
    expect(result.rows[1]!.channel).toBe("SOCIAL_MEDIA");
    expect(result.errors.map((e) => e.row)).toEqual([3, 4]);
  });

  it("accepts a JSON array or { interactions: [...] }", () => {
    const rows = [{ channel: "USSD", message: "USSD code not working" }];
    expect(validateImportRecords(parseRawRecords("json", JSON.stringify(rows))).rows).toHaveLength(1);
    expect(validateImportRecords(parseRawRecords("json", JSON.stringify({ interactions: rows }))).rows).toHaveLength(1);
    expect(() => parseRawRecords("json", '{"foo":1}')).toThrow();
  });

  it("rejects future timestamps and negative amounts", () => {
    const r = validateImportRecords([
      { channel: "WEB", message: "Card declined", timestamp: "2099-01-01" },
      { channel: "WEB", message: "Card declined", amount: -5 },
    ]);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(2);
  });
});

describe("customer content sanitisation", () => {
  it("strips markup and control characters", () => {
    expect(sanitizeText("<script>alert(1)</script>Transfer\u0000 failed  ")).toBe("alert(1) Transfer failed");
  });

  it("redacts PII before text is sent to the AI", () => {
    const out = redactPII(
      "Card 4111 1111 1111 1111, acct 0123456789, call 08031234567 or me@example.com about ₦50,000",
    );
    expect(out).not.toMatch(/4111|0123456789|08031234567|me@example\.com/);
    expect(out).toContain("[CARD]");
    expect(out).toContain("[ACCOUNT]");
    expect(out).toContain("[PHONE]");
    expect(out).toContain("[EMAIL]");
    expect(out).toContain("₦50,000");
  });
});
