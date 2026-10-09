import "server-only";
import { sql } from "@/lib/db/client";
import type { DirectoryDepartment, DirectoryTeam } from "@/types";
import type { DirectoryTeamForPrompt } from "@/prompts/team-recommendation";

/** Full organisational responsibility directory for one bank. */
export async function getDirectory(bankId: string): Promise<DirectoryDepartment[]> {
  const [departments, teams, responsibilities, products, systems] = await Promise.all([
    sql<{ id: string; name: string; description: string | null }[]>`
      select id, name, description from departments where bank_id = ${bankId} order by name`,
    sql<{ id: string; name: string; description: string | null; department_id: string; department_name: string }[]>`
      select t.id, t.name, t.description, t.department_id, d.name as department_name
      from teams t join departments d on d.id = t.department_id and d.bank_id = t.bank_id
      where t.bank_id = ${bankId}
      order by t.name`,
    sql<{ id: string; team_id: string; responsibility: string }[]>`
      select id, team_id, responsibility from team_responsibilities
      where bank_id = ${bankId} order by created_at, responsibility`,
    sql<{ team_id: string; code: string; name: string }[]>`
      select o.team_id, p.code, p.name
      from team_product_ownership o join products p on p.id = o.product_id and p.bank_id = o.bank_id
      where o.bank_id = ${bankId} order by p.name`,
    sql<{ owner_team_id: string; name: string; description: string | null }[]>`
      select owner_team_id, name, description from systems
      where bank_id = ${bankId} and owner_team_id is not null order by name`,
  ]);

  const teamMap = new Map<string, DirectoryTeam>();
  for (const t of teams) {
    teamMap.set(t.id, { ...t, responsibilities: [], products: [], systems: [] });
  }
  for (const r of responsibilities)
    teamMap.get(r.team_id)?.responsibilities.push({ id: r.id, responsibility: r.responsibility });
  for (const p of products) teamMap.get(p.team_id)?.products.push({ code: p.code, name: p.name });
  for (const s of systems) teamMap.get(s.owner_team_id)?.systems.push({ name: s.name, description: s.description });

  return departments.map((d) => ({
    ...d,
    teams: [...teamMap.values()].filter((t) => t.department_id === d.id),
  }));
}

/** Directory records supplied to the AI — the only teams it may choose from. */
export async function getDirectoryForPrompt(bankId: string): Promise<DirectoryTeamForPrompt[]> {
  const departments = await getDirectory(bankId);
  return departments.flatMap((d) =>
    d.teams.map((t) => ({
      team_id: t.id,
      team_name: t.name,
      department: d.name,
      responsibilities: t.responsibilities.map((r) => r.responsibility),
      products_owned: t.products.map((p) => p.code),
      systems_owned: t.systems.map((s) => s.name),
    })),
  );
}

export interface TeamRef {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
}

export async function listTeams(bankId: string): Promise<TeamRef[]> {
  return sql<TeamRef[]>`
    select t.id, t.name, t.department_id, d.name as department_name
    from teams t join departments d on d.id = t.department_id and d.bank_id = t.bank_id
    where t.bank_id = ${bankId}
    order by d.name, t.name`;
}

export async function getTeam(bankId: string, teamId: string): Promise<TeamRef | null> {
  const rows = await sql<TeamRef[]>`
    select t.id, t.name, t.department_id, d.name as department_name
    from teams t join departments d on d.id = t.department_id and d.bank_id = t.bank_id
    where t.bank_id = ${bankId} and t.id = ${teamId}`;
  return rows[0] ?? null;
}

export async function listProducts(bankId: string): Promise<{ id: string; code: string; name: string }[]> {
  return sql`select id, code, name from products where bank_id = ${bankId} order by name`;
}

export async function listSystems(bankId: string) {
  return sql<{ name: string; description: string | null; product: string | null }[]>`
    select s.name, s.description, p.code as product
    from systems s left join products p on p.id = s.product_id and p.bank_id = s.bank_id
    where s.bank_id = ${bankId}
    order by s.name`;
}

// ---------------------------------------------------------------------------
// Directory configuration (mutations)
// ---------------------------------------------------------------------------

export async function createDepartment(bankId: string, name: string, description?: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into departments (bank_id, name, description)
    values (${bankId}, ${name}, ${description ?? null})
    returning id`;
  return row!;
}

export async function createTeam(bankId: string, departmentId: string, name: string, description?: string) {
  // The composite FK (bank_id, department_id) rejects departments of another bank.
  const [row] = await sql<{ id: string }[]>`
    insert into teams (bank_id, department_id, name, description)
    values (${bankId}, ${departmentId}, ${name}, ${description ?? null})
    returning id`;
  return row!;
}

export async function addResponsibility(bankId: string, teamId: string, responsibility: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into team_responsibilities (bank_id, team_id, responsibility)
    values (${bankId}, ${teamId}, ${responsibility})
    returning id`;
  return row!;
}

export async function removeResponsibility(bankId: string, teamId: string, responsibilityId: string): Promise<boolean> {
  const rows = await sql`
    delete from team_responsibilities
    where bank_id = ${bankId} and team_id = ${teamId} and id = ${responsibilityId}
    returning id`;
  return rows.length > 0;
}

export async function setTeamProducts(bankId: string, teamId: string, productCodes: string[]) {
  await sql.begin(async (tx) => {
    await tx`delete from team_product_ownership where bank_id = ${bankId} and team_id = ${teamId}`;
    if (productCodes.length === 0) return;
    await tx`
      insert into team_product_ownership (bank_id, team_id, product_id)
      select ${bankId}, ${teamId}, p.id from products p
      where p.bank_id = ${bankId} and p.code = any(${productCodes})`;
  });
}
