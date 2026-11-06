import "server-only";
import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db/client";
import { account, user } from "@/server/db/schema";
import { env } from "@/server/env";
import { ensureDefaultSettings } from "@/server/settings/store";
import { writeAudit } from "@/server/audit";

const g = globalThis as unknown as { __ifBootstrapped?: boolean };

/**
 * First boot: when the user table is empty and DEV_BOOTSTRAP_EMAIL/PASSWORD are
 * set, create that account as a developer. Never runs once any user exists,
 * so the env password cannot be used to take over a live install.
 */
export async function ensureBootstrap(): Promise<{ created: boolean; reason?: string }> {
  if (g.__ifBootstrapped) return { created: false, reason: "already-checked" };
  await ensureDefaultSettings();
  const [row] = await db.select({ n: count() }).from(user);
  if ((row?.n ?? 0) > 0) {
    g.__ifBootstrapped = true;
    return { created: false, reason: "users-exist" };
  }
  const email = env.DEV_BOOTSTRAP_EMAIL?.toLowerCase();
  const password = env.DEV_BOOTSTRAP_PASSWORD;
  if (!email || !password) return { created: false, reason: "env-missing" };
  if (password.length < 8) return { created: false, reason: "password-too-short" };

  const id = randomUUID();
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id, email, name: "Developer", emailVerified: true, role: "developer" });
    await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash });
  });
  await writeAudit({ actor: { id, email }, action: "bootstrap.developer_created", targetType: "user", targetId: id, after: { email, role: "developer" } });
  g.__ifBootstrapped = true;
  return { created: true };
}
