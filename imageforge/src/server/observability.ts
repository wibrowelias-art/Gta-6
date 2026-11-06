import "server-only";
import { count, desc, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generationJobs, images, refusalEvents, user } from "@/server/db/schema";

export async function getOverview() {
  const day = new Date(Date.now() - 86400_000);
  const week = new Date(Date.now() - 7 * 86400_000);
  const [queue, jobs24, refusals, users, imgs, recent] = await Promise.all([
    db.select({ n: count() }).from(generationJobs).where(inArray(generationJobs.status, ["queued", "running"])),
    db
      .select({ status: generationJobs.status, n: count(), cost: sql<string>`coalesce(sum(${generationJobs.costEstimateUsd}),0)` })
      .from(generationJobs)
      .where(gte(generationJobs.createdAt, day))
      .groupBy(generationJobs.status),
    db
      .select({ category: refusalEvents.category, n: count(), hard: sql<boolean>`bool_or(${refusalEvents.hard})` })
      .from(refusalEvents)
      .where(gte(refusalEvents.createdAt, week))
      .groupBy(refusalEvents.category)
      .orderBy(desc(count()))
      .limit(8),
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(images).where(isNull(images.deletedAt)),
    db
      .select({
        id: generationJobs.id,
        status: generationJobs.status,
        provider: generationJobs.provider,
        model: generationJobs.model,
        latencyMs: generationJobs.latencyMs,
        errorCode: generationJobs.errorCode,
        source: generationJobs.source,
        createdAt: generationJobs.createdAt,
      })
      .from(generationJobs)
      .orderBy(desc(generationJobs.createdAt))
      .limit(12),
  ]);
  const by = Object.fromEntries(jobs24.map((r) => [r.status, r.n]));
  const total = jobs24.reduce((a, r) => a + r.n, 0);
  const failed = by.failed ?? 0;
  const finished = (by.succeeded ?? 0) + failed;
  return {
    queueDepth: queue[0]?.n ?? 0,
    jobs24h: total,
    succeeded24h: by.succeeded ?? 0,
    blocked24h: by.blocked ?? 0,
    errorRate24h: finished ? failed / finished : 0,
    cost24h: jobs24.reduce((a, r) => a + Number(r.cost), 0),
    topRefusals: refusals,
    users: users[0]?.n ?? 0,
    images: imgs[0]?.n ?? 0,
    recent,
  };
}
