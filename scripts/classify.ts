import "./load-env";
import { analyzeIssue, listSignificantIssues } from "@/lib/ai/analyze-issue";
import { classifyPending } from "@/lib/ai/classify";
import { recomputeIssues } from "@/lib/clustering/aggregate";
import { closeSql, sql } from "@/lib/db/client";
import type { Bank } from "@/types";

/**
 * Headless pipeline runner (same code paths as the UI):
 *   npm run classify                       classify all pending interactions for every bank
 *   npm run classify -- --bank=kestrel-trust
 *   npm run classify -- --analyze          also run root-cause + team recommendation for significant issues
 */
async function main() {
  const bankArg = process.argv.find((a) => a.startsWith("--bank="))?.split("=")[1];
  const analyze = process.argv.includes("--analyze");

  const banks = await sql<Bank[]>`
    select id, slug, name, description, logo_url, currency, status, created_at from banks
    where status = 'ACTIVE' ${bankArg ? sql`and slug = ${bankArg}` : sql``}
    order by name`;
  if (banks.length === 0)
    throw new Error(bankArg ? `Bank "${bankArg}" not found` : "No banks found — run npm run db:seed");

  for (const bank of banks) {
    console.log(`\n${bank.name}`);
    let total = 0;
    for (;;) {
      const r = await classifyPending(bank.id, 100, "CLI");
      if (r.processed === 0) break;
      total += r.processed;
      console.log(`  classified ${total} (AI ${r.aiCount}, rules ${r.rulesCount}) — ${r.remaining} remaining`);
      for (const n of r.notes) console.log(`    note: ${n}`);
      if (r.remaining === 0) break;
    }
    const agg = await recomputeIssues(bank.id, { audit: true, actor: "CLI", currency: bank.currency });
    console.log(`  ${agg.issues} issue groups detected (period ending ${agg.anchor?.toISOString() ?? "n/a"})`);

    if (analyze) {
      const significant = await listSignificantIssues(bank.id);
      for (const issue of significant) {
        const r = await analyzeIssue(bank, issue.id, "CLI");
        console.log(`  analysed ${issue.title}: ${r.method}, ownership ${r.ownershipStatus}`);
      }
    }
  }
}

main()
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeSql());
