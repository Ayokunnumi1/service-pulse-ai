import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BANK_COOKIE } from "@/lib/constants";
import { getBank } from "@/lib/db/banks";
import { uuid } from "@/lib/validation/api";
import type { Bank } from "@/types";

/**
 * Resolves the bank (tenant) for the current request from the selection
 * cookie. The bank id is always re-validated against the database, and all
 * data access functions take this bank id explicitly — no query runs without
 * a bank scope.
 */
export async function getActiveBank(): Promise<Bank | null> {
  const store = await cookies();
  const raw = store.get(BANK_COOKIE)?.value;
  if (!raw || !uuid.safeParse(raw).success) return null;
  return getBank(raw);
}

/** For pages: redirect to bank selection when no valid bank is selected. */
export async function requireBank(): Promise<Bank> {
  const bank = await getActiveBank();
  if (!bank) redirect("/");
  return bank;
}
