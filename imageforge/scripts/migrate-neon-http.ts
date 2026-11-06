/**
 * Apply migrations to Neon over HTTPS (port 443) instead of Postgres TCP (5432).
 * Useful from networks that block 5432 (some CI runners, sandboxes). Same
 * __drizzle_migrations bookkeeping as `npm run db:migrate`, so either can be used later.
 * Run with: NODE_USE_ENV_PROXY=1 npx tsx scripts/migrate-neon-http.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(raw));
await migrate(db, { migrationsFolder: "./drizzle" });
const sql = neon(raw);
const tables = await sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
const plans = await sql`select id, daily_quota from plans order by id`;
console.log(`migrations applied over HTTPS · ${tables[0]?.n} public tables · plans: ${plans.map((p) => p.id).join(", ")}`);
