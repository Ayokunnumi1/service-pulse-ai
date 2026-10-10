import { NextResponse } from "next/server";
import { parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { createDepartment } from "@/lib/db/directory";
import { CreateDepartmentSchema } from "@/lib/validation/api";

export const POST = withBank(async (req, bank) => {
  const { name, description } = await parseBody(req, CreateDepartmentSchema);
  const row = await createDepartment(bank.id, name, description);
  await writeAudit({
    bankId: bank.id,
    eventType: "DIRECTORY_UPDATED",
    actor: "Demo User",
    details: { action: "department_created", department_id: row.id, name },
  });
  return NextResponse.json(row, { status: 201 });
});
