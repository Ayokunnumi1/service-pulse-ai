import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { insertImportedInteractions } from "@/lib/db/interactions";
import { ImportRequestSchema } from "@/lib/validation/api";
import { parseRawRecords, validateImportRecords } from "@/lib/validation/import";

/** Imports customer interactions from CSV or JSON. Rows are validated and sanitised. */
export const POST = withBank(async (req, bank) => {
  const { format, content } = await parseBody(req, ImportRequestSchema);

  let records: Record<string, unknown>[];
  try {
    records = parseRawRecords(format, content);
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "File could not be parsed");
  }
  if (records.length === 0) throw new ApiError(400, "The file contains no rows");

  const { rows, errors, totalRows } = validateImportRecords(records);
  const imported = await insertImportedInteractions(bank.id, rows);

  await writeAudit({
    bankId: bank.id,
    eventType: "DATA_IMPORTED",
    actor: "Demo User",
    inputData: { format, total_rows: totalRows },
    details: { imported, rejected: errors.length },
  });

  return NextResponse.json({ imported, rejected: errors.length, errors: errors.slice(0, 20), totalRows });
});
