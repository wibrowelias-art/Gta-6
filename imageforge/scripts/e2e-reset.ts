/** Resets the e2e database: migrate, truncate, seed default settings + bootstrap developer. NEVER run against production. */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !/test|e2e|localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to reset: DATABASE_URL must point at a local/test database.");
  process.exit(1);
}
const client = postgres(url, { max: 1, onnotice: () => {} });
const d = drizzle(client);
await migrate(d, { migrationsFolder: "./drizzle" });
await d.execute(
  sql`TRUNCATE "audit_log","refusal_events","rate_limit_buckets","quota_overrides","usage_counters","images","generation_jobs","style_presets","policy_rules","app_settings","invites","verification","account","session","user" RESTART IDENTITY CASCADE`,
);
await client.end();
const { ensureBootstrap } = await import("../src/server/bootstrap");
const { closeDb } = await import("../src/server/db/client");
console.log("bootstrap:", await ensureBootstrap());
await closeDb();
