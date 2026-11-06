import "server-only";
import { and, eq, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { images, refusalEvents } from "@/server/db/schema";
import { pruneRateLimits } from "@/server/rate-limit";
import { getSettings } from "@/server/settings/store";
import { storageFor } from "@/server/storage";

/**
 * Deletes images older than the live retention window (or past their stored
 * expiry), including their blobs. Also prunes old rate-limit buckets.
 */
export async function runRetention(opts: { now?: Date; batch?: number } = {}) {
  const now = opts.now ?? new Date();
  const s = await getSettings();
  const conditions = [and(isNotNull(images.expiresAt), lt(images.expiresAt, now))];
  if (s.generation.retentionDays > 0) conditions.push(lt(images.createdAt, new Date(now.getTime() - s.generation.retentionDays * 86400_000)));
  let deleted = 0;
  let blobErrors = 0;
  for (;;) {
    const rows = await db
      .select({ id: images.id, storageKey: images.storageKey })
      .from(images)
      .where(s.generation.retentionDays > 0 ? or(...conditions) : conditions[0])
      .limit(opts.batch ?? 200);
    if (rows.length === 0) break;
    for (const r of rows) {
      try {
        await storageFor(r.storageKey).delete(r.storageKey);
      } catch {
        blobErrors++;
      }
      await db.delete(images).where(eq(images.id, r.id));
      deleted++;
    }
    if (rows.length < (opts.batch ?? 200)) break;
  }
  await pruneRateLimits();
  // Refusal events are kept 180 days for abuse review.
  await db.delete(refusalEvents).where(lt(refusalEvents.createdAt, new Date(now.getTime() - 180 * 86400_000)));
  return { deleted, blobErrors, retentionDays: s.generation.retentionDays };
}
