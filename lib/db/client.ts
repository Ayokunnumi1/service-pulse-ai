import postgres from "postgres";
import { env } from "@/lib/env";

/**
 * Single shared Postgres connection pool (Supabase Postgres in production).
 * All queries use postgres.js tagged templates, which are always
 * parameterised — user input is never concatenated into SQL.
 */
declare global {
  var __servicePulseSql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const { DATABASE_URL, DATABASE_SSL, DATABASE_POOL_MAX } = env();
  return postgres(DATABASE_URL, {
    max: DATABASE_POOL_MAX ?? (process.env.NODE_ENV === "production" ? 5 : 8),
    idle_timeout: 20,
    connect_timeout: 15,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    ssl: DATABASE_SSL ? "require" : undefined,
    onnotice: () => {},
    types: {
      // Return numeric columns as JS numbers (values here are counts, money and ratios).
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

function getSql(): postgres.Sql {
  if (!globalThis.__servicePulseSql) {
    globalThis.__servicePulseSql = createClient();
  }
  return globalThis.__servicePulseSql;
}

/**
 * Lazily-initialised client: the connection pool is only created on first
 * use, so importing this module during `next build` needs no database.
 */
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply(_target, _thisArg, args) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const client = getSql();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function closeSql(): Promise<void> {
  if (globalThis.__servicePulseSql) {
    await globalThis.__servicePulseSql.end({ timeout: 5 });
    globalThis.__servicePulseSql = undefined;
  }
}
