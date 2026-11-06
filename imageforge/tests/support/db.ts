import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { invalidateSettingsCache } from "@/server/settings/store";

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

export async function resetDb() {
  await db.execute(sql`TRUNCATE "audit_log","refusal_events","rate_limit_buckets","quota_overrides","usage_counters","images","generation_jobs","style_presets","policy_rules","app_settings","invites","verification","account","session","user" RESTART IDENTITY CASCADE`);
  invalidateSettingsCache();
}

export async function makeUser(role: "user" | "developer" = "user", planId = "free") {
  const id = randomUUID();
  await db.insert(user).values({ id, email: `${id}@test.local`, name: "Test", role, planId });
  return { id, email: `${id}@test.local`, name: "Test", role, planId, banned: false, theme: "dark", devTotpEnabled: false };
}
