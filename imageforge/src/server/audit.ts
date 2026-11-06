import "server-only";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import type { ReqMeta } from "@/server/request";

export type Actor = { id: string; email: string };

export async function writeAudit(entry: {
  actor: Actor | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: ReqMeta;
}) {
  await db.insert(auditLog).values({
    actorId: entry.actor?.id ?? null,
    actorEmail: entry.actor?.email ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    ip: entry.meta?.ip ?? null,
    userAgent: entry.meta?.userAgent ?? null,
    before: entry.before === undefined ? null : (JSON.parse(JSON.stringify(entry.before)) as unknown),
    after: entry.after === undefined ? null : (JSON.parse(JSON.stringify(entry.after)) as unknown),
  });
}

export async function searchAudit(q: { text?: string; action?: string; from?: Date; to?: Date; limit?: number; offset?: number }) {
  const where: SQL[] = [];
  if (q.action) where.push(eq(auditLog.action, q.action));
  if (q.from) where.push(gte(auditLog.createdAt, q.from));
  if (q.to) where.push(lte(auditLog.createdAt, q.to));
  if (q.text) {
    const like = `%${q.text.replace(/[%_]/g, "\\$&")}%`;
    const cond = or(
      ilike(auditLog.action, like),
      ilike(auditLog.actorEmail, like),
      ilike(auditLog.targetId, like),
      ilike(auditLog.ip, like),
      sql`${auditLog.before}::text ilike ${like}`,
      sql`${auditLog.after}::text ilike ${like}`,
    );
    if (cond) where.push(cond);
  }
  return db
    .select()
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(q.limit ?? 50, 200))
    .offset(q.offset ?? 0);
}
