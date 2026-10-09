import "server-only";
import { CHANNELS, INTERACTION_STATUSES, SEVERITIES } from "@/lib/constants";
import { sql } from "@/lib/db/client";
import type { ImportRow } from "@/lib/validation/import";
import type { Interaction } from "@/types";

export const PAGE_SIZE = 25;

export interface InteractionFilters {
  q?: string;
  channel?: string;
  status?: string;
  issueGroup?: string;
  severity?: string;
  intent?: string;
  page?: number;
}

/** Whitelists filter values coming from the URL. */
export function parseFilters(params: Record<string, string | string[] | undefined>): InteractionFilters {
  const one = (k: string) => {
    const v = params[k];
    return typeof v === "string" && v.length > 0 && v.length <= 100 ? v : undefined;
  };
  const channel = one("channel");
  const status = one("status");
  const severity = one("severity");
  const intent = one("intent");
  const issueGroup = one("issue");
  const page = Number(one("page") ?? "1");
  return {
    q: one("q"),
    channel: channel && (CHANNELS as readonly string[]).includes(channel) ? channel : undefined,
    status: status && (INTERACTION_STATUSES as readonly string[]).includes(status) ? status : undefined,
    severity: severity && (SEVERITIES as readonly string[]).includes(severity) ? severity : undefined,
    intent: intent && /^[A-Z_]+$/.test(intent) ? intent : undefined,
    issueGroup: issueGroup && /^[A-Z0-9_]+$/.test(issueGroup) ? issueGroup : undefined,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export async function listInteractions(
  bankId: string,
  filters: InteractionFilters,
): Promise<{ rows: Interaction[]; total: number; page: number; pageCount: number }> {
  const page = filters.page ?? 1;
  const where = () => sql`
    where i.bank_id = ${bankId}
      ${filters.q ? sql`and i.message ilike ${"%" + filters.q.replace(/[%_\\]/g, "\\$&") + "%"}` : sql``}
      ${filters.channel ? sql`and i.channel = ${filters.channel}` : sql``}
      ${filters.status ? sql`and i.status = ${filters.status}` : sql``}
      ${filters.issueGroup ? sql`and c.issue_group = ${filters.issueGroup}` : sql``}
      ${filters.severity ? sql`and c.severity = ${filters.severity}` : sql``}
      ${filters.intent ? sql`and c.intent = ${filters.intent}` : sql``}`;

  const [countRow] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from interactions i
    left join interaction_classifications c on c.interaction_id = i.id and c.bank_id = i.bank_id
    ${where()}`;
  const total = countRow?.total ?? 0;

  const rows = await sql<Interaction[]>`
    select i.id, i.channel, i.message, i.customer_reference, i.branch, i.location, i.product, i.amount,
           i.occurred_at, i.status, i.source,
           c.category, c.issue, c.issue_group, c.intent, c.sentiment, c.severity,
           c.product as classified_product, c.systemic_issue_candidate, c.confidence, c.method
    from interactions i
    left join interaction_classifications c on c.interaction_id = i.id and c.bank_id = i.bank_id
    ${where()}
    order by i.occurred_at desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;

  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listIssueGroupsInUse(bankId: string): Promise<string[]> {
  const rows = await sql<{ issue_group: string }[]>`
    select distinct issue_group from interaction_classifications where bank_id = ${bankId} order by issue_group`;
  return rows.map((r) => r.issue_group);
}

export async function insertImportedInteractions(bankId: string, rows: ImportRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const records = rows.map((r) => ({
    bank_id: bankId,
    channel: r.channel,
    message: r.message,
    customer_reference: r.customer_reference,
    branch: r.branch,
    location: r.location,
    product: r.product,
    amount: r.amount,
    occurred_at: r.timestamp,
    status: "PENDING",
    source: "IMPORT",
  }));
  await sql.begin(async (tx) => {
    for (let i = 0; i < records.length; i += 500) {
      await tx`insert into interactions ${tx(records.slice(i, i + 500))}`;
    }
  });
  return records.length;
}

/** Interactions currently classified by the rules fallback (candidates for AI re-classification). */
export async function getRulesClassifiedCount(bankId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n
    from interaction_classifications c
    join interactions i on i.id = c.interaction_id and i.bank_id = c.bank_id
    where c.bank_id = ${bankId} and c.method = 'RULES' and i.status = 'CLASSIFIED'`;
  return row?.n ?? 0;
}

export async function getPendingCount(bankId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from interactions where bank_id = ${bankId} and status = 'PENDING'`;
  return row?.n ?? 0;
}
