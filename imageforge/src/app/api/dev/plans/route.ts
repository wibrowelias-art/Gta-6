import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { plans } from "@/server/db/schema";
import { handler, ok, readJson } from "@/server/http";

const plan = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(40),
  dailyQuota: z.number().int().min(0),
  monthlyQuota: z.number().int().min(0),
  maxImagesPerRequest: z.number().int().min(1).max(4),
  stripePriceId: z.string().max(100).nullable().optional(),
  active: z.boolean(),
});

export const PUT = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const p = plan.parse(await readJson(req));
  const before = await db.query.plans.findFirst({ where: eq(plans.id, p.id) });
  const values = { ...p, stripePriceId: p.stripePriceId || null };
  const [row] = await db.insert(plans).values(values).onConflictDoUpdate({ target: plans.id, set: values }).returning();
  await writeAudit({ actor, action: before ? "plan.update" : "plan.create", targetType: "plan", targetId: p.id, before: before ?? null, after: row, meta });
  return ok(row);
});
