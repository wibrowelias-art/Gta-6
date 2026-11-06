import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rateLimitBuckets } from "@/server/db/schema";

/** Fixed-window counter in Postgres. Returns whether the hit is within `limit` for the current window. */
export async function hit(key: string, limit: number, windowMs = 60_000): Promise<{ ok: boolean; count: number; resetAt: Date }> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimitBuckets.key, rateLimitBuckets.windowStart], set: { count: sql`${rateLimitBuckets.count} + 1` } })
    .returning({ count: rateLimitBuckets.count });
  const count = row?.count ?? 1;
  return { ok: count <= limit, count, resetAt: new Date(windowStart.getTime() + windowMs) };
}

export async function pruneRateLimits(olderThanMs = 60 * 60 * 1000) {
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, new Date(Date.now() - olderThanMs)));
}
