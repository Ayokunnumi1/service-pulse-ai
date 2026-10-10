import { NextResponse } from "next/server";
import { parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { createTeam } from "@/lib/db/directory";
import { CreateTeamSchema } from "@/lib/validation/api";

export const POST = withBank(async (req, bank) => {
  const { departmentId, name, description } = await parseBody(req, CreateTeamSchema);
  const row = await createTeam(bank.id, departmentId, name, description);
  await writeAudit({
    bankId: bank.id,
    eventType: "DIRECTORY_UPDATED",
    actor: "Demo User",
    details: { action: "team_created", team_id: row.id, name },
  });
  return NextResponse.json(row, { status: 201 });
});
