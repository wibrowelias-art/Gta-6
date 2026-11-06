import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __ifDb?: DB; __ifSql?: postgres.Sql };

function create(): DB {
  const sql = postgres(env.DATABASE_URL, {
    max: process.env.VERCEL ? 1 : 10,
    prepare: false, // safe with Neon / PgBouncer pooled URLs
    idle_timeout: 20,
  });
  g.__ifSql = sql;
  return drizzle(sql, { schema });
}

/** Lazily-created singleton so builds without DATABASE_URL still succeed. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    g.__ifDb ??= create();
    const value = Reflect.get(g.__ifDb, prop);
    return typeof value === "function" ? value.bind(g.__ifDb) : value;
  },
});

export async function closeDb() {
  await g.__ifSql?.end({ timeout: 5 });
  g.__ifDb = undefined;
  g.__ifSql = undefined;
}

export { schema };
