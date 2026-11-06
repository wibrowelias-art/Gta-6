import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { plans, quotaOverrides, usageCounters } from "@/server/db/schema";
import type { Role } from "@/server/db/schema";
import type { AppSettings } from "@/server/settings/schema";

export function periodStarts(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return { day: d, month: `${d.slice(0, 7)}-01` };
}

/** Effective limits: role quota, capped by plan for regular users, replaced by a per-user override if set. Pure. */
export function effectiveLimits(
  role: Role,
  settings: AppSettings,
  plan: { dailyQuota: number; monthlyQuota: number } | null,
  override: { dailyQuota: number | null; monthlyQuota: number | null } | null,
) {
  const r = settings.quotas.byRole[role];
  let daily = r.daily;
  let monthly = r.monthly;
  if (role === "user" && plan) {
    daily = Math.min(daily, plan.dailyQuota);
    monthly = Math.min(monthly, plan.monthlyQuota);
  }
  if (override?.dailyQuota != null) daily = override.dailyQuota;
  if (override?.monthlyQuota != null) monthly = override.monthlyQuota;
  return { daily, monthly };
}

export async function getUsage(u: { id: string; role: Role; planId: string }, settings: AppSettings) {
  const { day, month } = periodStarts();
  const [plan, override, counters] = await Promise.all([
    db.query.plans.findFirst({ where: eq(plans.id, u.planId) }),
    db.query.quotaOverrides.findFirst({ where: eq(quotaOverrides.userId, u.id) }),
    db
      .select()
      .from(usageCounters)
      .where(and(eq(usageCounters.userId, u.id), sql`((${usageCounters.periodType} = 'day' and ${usageCounters.periodStart} = ${day}) or (${usageCounters.periodType} = 'month' and ${usageCounters.periodStart} = ${month}))`)),
  ]);
  const limits = effectiveLimits(u.role, settings, plan ?? null, override ?? null);
  const usedDay = counters.find((c) => c.periodType === "day")?.used ?? 0;
  const usedMonth = counters.find((c) => c.periodType === "month")?.used ?? 0;
  return {
    limits,
    used: { daily: usedDay, monthly: usedMonth },
    remaining: Math.max(0, Math.min(limits.daily - usedDay, limits.monthly - usedMonth)),
    planId: u.planId,
    maxImagesPerRequest: plan?.maxImagesPerRequest ?? 4,
  };
}

export async function consumeQuota(userId: string, n: number) {
  const { day, month } = periodStarts();
  for (const [periodType, periodStart] of [
    ["day", day],
    ["month", month],
  ] as const) {
    await db
      .insert(usageCounters)
      .values({ userId, periodType, periodStart, used: n })
      .onConflictDoUpdate({ target: [usageCounters.userId, usageCounters.periodType, usageCounters.periodStart], set: { used: sql`${usageCounters.used} + ${n}` } });
  }
}

export async function resetQuota(userId: string) {
  const { day, month } = periodStarts();
  await db
    .delete(usageCounters)
    .where(and(eq(usageCounters.userId, userId), sql`((${usageCounters.periodType} = 'day' and ${usageCounters.periodStart} = ${day}) or (${usageCounters.periodType} = 'month' and ${usageCounters.periodStart} = ${month}))`));
}
