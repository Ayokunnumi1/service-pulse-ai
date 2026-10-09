import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { addResponsibility, getTeam } from "@/lib/db/directory";
import { AddResponsibilitySchema, uuid } from "@/lib/validation/api";

export const POST = withBank<{ params: Promise<{ id: string }> }>(async (req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid team id");
  const team = await getTeam(bank.id, id);
  if (!team) throw new ApiError(404, "Team not found");

  const { responsibility } = await parseBody(req, AddResponsibilitySchema);
  const row = await addResponsibility(bank.id, team.id, responsibility);
  await writeAudit({
    bankId: bank.id,
    eventType: "DIRECTORY_UPDATED",
    actor: "Demo User",
    details: { action: "responsibility_added", team: team.name, responsibility },
  });
  return NextResponse.json(row, { status: 201 });
});
