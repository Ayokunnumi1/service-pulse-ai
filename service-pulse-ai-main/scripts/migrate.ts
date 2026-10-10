import "./load-env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { closeSql, sql } from "@/lib/db/client";

/**
 * Applies supabase/migrations/*.sql in filename order, recording each in
 * _migrations. Works against Supabase Postgres or any Postgres 15+.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset drop all ServicePulse tables first (destructive)
 */
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const TABLES = [
  "audit_log",
  "issue_notes",
  "issue_analyses",
  "issues",
  "interaction_classifications",
  "interactions",
  "branches",
  "team_product_ownership",
  "systems",
  "products",
  "team_responsibilities",
  "teams",
  "departments",
  "banks",
  "_migrations",
];

async function main() {
  if (process.argv.includes("--reset")) {
    console.log("Resetting schema (dropping ServicePulse tables)…");
    for (const table of TABLES) {
      await sql.unsafe(`drop table if exists ${table} cascade`);
    }
  }

  await sql`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
  await sql`alter table _migrations enable row level security`;

  const applied = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`Applying ${file}…`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into _migrations (name) values (${file})`;
    });
    count++;
  }
  console.log(count === 0 ? "Database is up to date." : `Applied ${count} migration(s).`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeSql());
