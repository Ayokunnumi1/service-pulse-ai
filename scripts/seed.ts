import "./load-env";
import { closeSql, sql } from "@/lib/db/client";
import { PRODUCT_LABELS } from "@/lib/constants";
import { generateInteractions } from "@/data/seed/generate";
import { SEED_BANKS, type SeedBank } from "@/data/seed/organisation";

/**
 * Seeds fictional banks, their organisational responsibility directories,
 * branches, products, systems and synthetic customer interactions.
 * Interactions are inserted as PENDING so they flow through AI
 * classification inside the app (Complaints → "Classify pending").
 *
 * Re-running replaces the seeded banks (and everything that belongs to them).
 */

async function seedBank(bank: SeedBank, anchor: Date) {
  await sql.begin(async (tx) => {
    await tx`delete from banks where slug = ${bank.slug}`;

    const [row] = await tx<{ id: string }[]>`
      insert into banks (slug, name, description, status, currency)
      values (${bank.slug}, ${bank.name}, ${bank.description}, 'ACTIVE', 'NGN')
      returning id`;
    const bankId = row!.id;

    // Products
    const productIds = new Map<string, string>();
    for (const code of bank.products) {
      const [p] = await tx<{ id: string }[]>`
        insert into products (bank_id, code, name)
        values (${bankId}, ${code}, ${PRODUCT_LABELS[code]})
        returning id`;
      productIds.set(code, p!.id);
    }

    // Departments → teams → responsibilities / product ownership
    const teamIds = new Map<string, string>();
    for (const dept of bank.departments) {
      const [d] = await tx<{ id: string }[]>`
        insert into departments (bank_id, name, description)
        values (${bankId}, ${dept.name}, ${dept.description})
        returning id`;
      for (const team of dept.teams) {
        const [t] = await tx<{ id: string }[]>`
          insert into teams (bank_id, department_id, name, description)
          values (${bankId}, ${d!.id}, ${team.name}, ${team.description})
          returning id`;
        teamIds.set(team.name, t!.id);
        for (const responsibility of team.responsibilities) {
          await tx`
            insert into team_responsibilities (bank_id, team_id, responsibility)
            values (${bankId}, ${t!.id}, ${responsibility})`;
        }
        for (const code of team.products) {
          const productId = productIds.get(code);
          if (!productId) continue;
          await tx`
            insert into team_product_ownership (bank_id, team_id, product_id)
            values (${bankId}, ${t!.id}, ${productId})`;
        }
      }
    }

    for (const system of bank.systems) {
      await tx`
        insert into systems (bank_id, name, description, product_id, owner_team_id)
        values (${bankId}, ${system.name}, ${system.description},
                ${system.product ? (productIds.get(system.product) ?? null) : null},
                ${teamIds.get(system.ownerTeam) ?? null})`;
    }

    for (const branch of bank.branches) {
      await tx`
        insert into branches (bank_id, code, name, city, region)
        values (${bankId}, ${branch.code}, ${branch.name}, ${branch.city}, ${branch.region})`;
    }

    const interactions = generateInteractions(bank, anchor).map((i) => ({
      bank_id: bankId,
      channel: i.channel,
      message: i.message,
      customer_reference: i.customer_reference,
      branch: i.branch,
      location: i.location,
      product: i.product,
      amount: i.amount,
      occurred_at: i.occurred_at,
      status: "PENDING",
      source: "SEED",
    }));
    for (let i = 0; i < interactions.length; i += 400) {
      const chunk = interactions.slice(i, i + 400);
      await tx`insert into interactions ${tx(chunk)}`;
    }

    console.log(
      `  ${bank.name}: ${bank.departments.reduce((s, d) => s + d.teams.length, 0)} teams, ` +
        `${bank.branches.length} branches, ${interactions.length} interactions`,
    );
  });
}

async function main() {
  const anchor = new Date();
  console.log("Seeding Nigerian commercial banks…");
  await sql`delete from banks where slug in ('kestrel-trust', 'harbourline')`;
  for (const bank of SEED_BANKS) {
    await seedBank(bank, anchor);
  }
  console.log("Done. Open the app, choose a bank and run classification from the Complaints page.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeSql());
