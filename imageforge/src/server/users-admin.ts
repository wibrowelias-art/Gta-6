import "server-only";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAudit, type Actor } from "@/server/audit";
import { db } from "@/server/db/client";
import { images, plans, quotaOverrides, session, user, usageCounters } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { periodStarts, resetQuota } from "@/server/quota";
import type { ReqMeta } from "@/server/request";
import { storageFor } from "@/server/storage";

export async function listUsers(q: { text?: string; limit?: number; offset?: number }) {
  const { day } = periodStarts();
  const like = q.text ? `%${q.text.replace(/[%_]/g, "\\$&")}%` : null;
  return db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      planId: user.planId,
      banned: user.banned,
      createdAt: user.createdAt,
      images: sql<number>`(select count(*)::int from ${images} where ${images.userId} = ${user.id} and ${images.deletedAt} is null)`,
      usedToday: sql<number>`coalesce((select ${usageCounters.used} from ${usageCounters} where ${usageCounters.userId} = ${user.id} and ${usageCounters.periodType} = 'day' and ${usageCounters.periodStart} = ${day}), 0)`,
      overrideDaily: quotaOverrides.dailyQuota,
      overrideMonthly: quotaOverrides.monthlyQuota,
    })
    .from(user)
    .leftJoin(quotaOverrides, eq(quotaOverrides.userId, user.id))
    .where(like ? or(ilike(user.email, like), ilike(user.name, like)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(Math.min(q.limit ?? 50, 500))
    .offset(q.offset ?? 0);
}

export const userActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_role"), userId: z.string(), role: z.enum(["user", "moderator", "developer"]) }),
  z.object({ action: z.literal("ban"), userId: z.string(), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("unban"), userId: z.string() }),
  z.object({ action: z.literal("wipe_generations"), userId: z.string() }),
  z.object({ action: z.literal("reset_quota"), userId: z.string() }),
  z.object({ action: z.literal("set_plan"), userId: z.string(), planId: z.string().max(40) }),
  z.object({
    action: z.literal("set_quota_override"),
    userId: z.string(),
    dailyQuota: z.number().int().min(0).nullable(),
    monthlyQuota: z.number().int().min(0).nullable(),
  }),
]);
export type UserAction = z.infer<typeof userActionSchema>;

export async function applyUserAction(actor: Actor, meta: ReqMeta, a: UserAction) {
  const target = await db.query.user.findFirst({ where: eq(user.id, a.userId) });
  if (!target) throw new HttpError(404, "NOT_FOUND", "User not found");
  const before = { role: target.role, banned: target.banned, planId: target.planId };
  const self = target.id === actor.id;

  switch (a.action) {
    case "set_role": {
      if (self && a.role !== "developer") throw new HttpError(400, "SELF_DEMOTE", "You can’t demote yourself.");
      if (target.role === "developer" && a.role !== "developer") await assertAnotherDeveloper(target.id);
      await db.update(user).set({ role: a.role, updatedAt: new Date() }).where(eq(user.id, target.id));
      break;
    }
    case "ban": {
      if (self) throw new HttpError(400, "SELF_BAN", "You can’t ban yourself.");
      if (target.role === "developer") await assertAnotherDeveloper(target.id);
      await db.update(user).set({ banned: true, banReason: a.reason ?? null, bannedAt: new Date() }).where(eq(user.id, target.id));
      await db.delete(session).where(eq(session.userId, target.id)); // sign out everywhere
      break;
    }
    case "unban":
      await db.update(user).set({ banned: false, banReason: null, bannedAt: null }).where(eq(user.id, target.id));
      break;
    case "wipe_generations": {
      const rows = await db.select({ id: images.id, key: images.storageKey }).from(images).where(eq(images.userId, target.id));
      for (const r of rows) await storageFor(r.key).delete(r.key).catch(() => {});
      await db.delete(images).where(eq(images.userId, target.id));
      await writeAudit({ actor, action: "user.wipe_generations", targetType: "user", targetId: target.id, before: { images: rows.length }, after: { images: 0 }, meta });
      return { ok: true, deleted: rows.length };
    }
    case "reset_quota":
      await resetQuota(target.id);
      await db.insert(quotaOverrides).values({ userId: target.id, resetAt: new Date() }).onConflictDoUpdate({ target: quotaOverrides.userId, set: { resetAt: new Date() } });
      break;
    case "set_plan": {
      const plan = await db.query.plans.findFirst({ where: eq(plans.id, a.planId) });
      if (!plan) throw new HttpError(400, "PLAN_NOT_FOUND", "Unknown plan");
      await db.update(user).set({ planId: plan.id }).where(eq(user.id, target.id));
      break;
    }
    case "set_quota_override":
      await db
        .insert(quotaOverrides)
        .values({ userId: target.id, dailyQuota: a.dailyQuota, monthlyQuota: a.monthlyQuota })
        .onConflictDoUpdate({ target: quotaOverrides.userId, set: { dailyQuota: a.dailyQuota, monthlyQuota: a.monthlyQuota } });
      break;
  }
  const after = await db.query.user.findFirst({ where: eq(user.id, target.id), columns: { role: true, banned: true, planId: true } });
  await writeAudit({ actor, action: `user.${a.action}`, targetType: "user", targetId: target.id, before, after: { ...after, ...("dailyQuota" in a ? { dailyQuota: a.dailyQuota, monthlyQuota: a.monthlyQuota } : {}) }, meta });
  return { ok: true };
}

async function assertAnotherDeveloper(excludingId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(user)
    .where(and(eq(user.role, "developer"), eq(user.banned, false), sql`${user.id} <> ${excludingId}`));
  if ((r?.n ?? 0) < 1) throw new HttpError(400, "LAST_DEVELOPER", "At least one active developer must remain.");
}

export async function usersCsv(): Promise<string> {
  const rows = await listUsers({ limit: 500 });
  const all = [...rows];
  for (let offset = 500; rows.length === 500; offset += 500) {
    const more = await listUsers({ limit: 500, offset });
    all.push(...more);
    if (more.length < 500) break;
  }
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // CSV/formula injection guard
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["id", "email", "name", "role", "plan", "banned", "images", "used_today", "created_at"];
  return [head.join(","), ...all.map((r) => [r.id, r.email, r.name, r.role, r.planId, r.banned, r.images, r.usedToday, r.createdAt].map(esc).join(","))].join("\n");
}

