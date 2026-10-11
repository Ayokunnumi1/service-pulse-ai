import "./load-env";
import { askServicePulse } from "@/lib/ai/assistant";
import { closeSql, sql } from "@/lib/db/client";
import type { Bank } from "@/types";

async function main() {
  const banks = await sql<Bank[]>`select id, slug, name, description, logo_url, currency, status, created_at from banks where status='ACTIVE' order by name`;
  console.log("banks:", banks.map((b) => b.slug).join(", "));
  const stats = await sql`select c.method, count(*)::int n from interaction_classifications c group by 1`;
  console.log("classifications by method:", stats.map((r) => `${r.method}=${r.n}`).join(" "));
  const pending = await sql`select count(*)::int n from interactions where status='PENDING'`;
  console.log("pending interactions:", pending[0]!.n);
  const bank = banks[0]!;
  const t = Date.now();
  const res = await askServicePulse(bank, "What is the biggest customer problem right now and which team should own it?");
  console.log(`\nAsk ServicePulse (${bank.slug}) in ${Date.now() - t}ms:`);
  console.log(JSON.stringify(res, null, 2).slice(0, 2500));
}
main().catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; }).finally(() => closeSql());
