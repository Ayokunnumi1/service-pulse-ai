import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleError, parseBody } from "@/lib/api";
import { BANK_COOKIE } from "@/lib/constants";
import { getBank } from "@/lib/db/banks";
import { SelectBankSchema } from "@/lib/validation/api";

/** Selects the active bank (tenant) for this browser session. */
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) {
      throw new ApiError(403, "Cross-origin request rejected");
    }
    const { bankId } = await parseBody(req, SelectBankSchema);
    const bank = await getBank(bankId);
    if (!bank) throw new ApiError(404, "Bank not found");

    const res = NextResponse.json({ bank: { id: bank.id, name: bank.name } });
    res.cookies.set(BANK_COOKIE, bank.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
