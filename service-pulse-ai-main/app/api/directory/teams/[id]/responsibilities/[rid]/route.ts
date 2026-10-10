import { NextResponse } from "next/server";
import { ApiError, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { getTeam, removeResponsibility } from "@/lib/db/directory";
import { uuid } from "@/lib/validation/api";

export const DELETE = withBank<{ params: Promise<{ id: string; rid: string }> }>(async (_req, bank, { params }) => {
  const { id, rid } = await params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(rid).success) throw new ApiError(400, "Invalid id");
  const team = await getTeam(bank.id, id);
  if (!team) throw new ApiError(404, "Team not found");

  const removed = await removeResponsibility(bank.id, team.id, rid);
  if (!removed) throw new ApiError(404, "Responsibility not found");
  await writeAudit({
    bankId: bank.id,
    eventType: "DIRECTORY_UPDATED",
    actor: "Demo User",
    details: { action: "responsibility_removed", team: team.name, responsibility_id: rid },
  });
  return NextResponse.json({ ok: true });
});
