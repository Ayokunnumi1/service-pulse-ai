import "server-only";
import { sql } from "@/lib/db/client";
import type { Bank } from "@/types";

export async function listBanks(): Promise<Bank[]> {
  return sql<Bank[]>`
    select id, slug, name, description, logo_url, currency, status, created_at
    from banks
    where status = 'ACTIVE'
    order by name`;
}

export async function getBank(id: string): Promise<Bank | null> {
  const rows = await sql<Bank[]>`
    select id, slug, name, description, logo_url, currency, status, created_at
    from banks
    where id = ${id} and status = 'ACTIVE'`;
  return rows[0] ?? null;
}

export interface BankSummary extends Bank {
  interactions: number;
  pending: number;
  open_issues: number;
  teams: number;
}

export async function listBankSummaries(): Promise<BankSummary[]> {
  return sql<BankSummary[]>`
    select b.id, b.slug, b.name, b.description, b.logo_url, b.currency, b.status, b.created_at,
      (select count(*)::int from interactions i where i.bank_id = b.id) as interactions,
      (select count(*)::int from interactions i where i.bank_id = b.id and i.status = 'PENDING') as pending,
      (select count(*)::int from issues s where s.bank_id = b.id and s.status <> 'RESOLVED'
         and s.trend_status in ('EMERGING', 'HIGH_CONCERN', 'CRITICAL')) as open_issues,
      (select count(*)::int from teams t where t.bank_id = b.id) as teams
    from banks b
    where b.status = 'ACTIVE'
    order by b.name`;
}
