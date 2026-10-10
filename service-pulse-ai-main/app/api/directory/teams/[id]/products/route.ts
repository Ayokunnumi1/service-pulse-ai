import { NextResponse } from "next/server";
import { ApiError, parseBody, withBank } from "@/lib/api";
import { writeAudit } from "@/lib/db/audit";
import { getTeam, setTeamProducts } from "@/lib/db/directory";
import { SetTeamProductsSchema, uuid } from "@/lib/validation/api";

/** Replaces the set of products a team owns. */
export const PUT = withBank<{ params: Promise<{ id: string }> }>(async (req, bank, { params }) => {
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new ApiError(400, "Invalid team id");
  const team = await getTeam(bank.id, id);
  if (!team) throw new ApiError(404, "Team not found");

  const { productCodes } = await parseBody(req, SetTeamProductsSchema);
  await setTeamProducts(bank.id, team.id, productCodes);
  await writeAudit({
    bankId: bank.id,
    eventType: "DIRECTORY_UPDATED",
    actor: "Demo User",
    details: { action: "products_updated", team: team.name, products: productCodes },
  });
  return NextResponse.json({ ok: true });
});
