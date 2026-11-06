import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { stylePresets } from "@/server/db/schema";
import { fail, handler, ok, readJson } from "@/server/http";

const preset = z.strictObject({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/, "lowercase letters, numbers and dashes"),
  name: z.string().trim().min(1).max(40),
  thumbnailUrl: z.union([z.literal(""), z.string().url().max(500)]).nullable().optional(),
  promptPrefix: z.string().max(500).default(""),
  promptSuffix: z.string().max(500).default(""),
  negativeDefault: z.string().max(500).default(""),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
});

export const POST = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const p = preset.parse(await readJson(req));
  const values = { ...p, thumbnailUrl: p.thumbnailUrl || null, updatedAt: new Date() };
  if (p.id) {
    const before = await db.query.stylePresets.findFirst({ where: eq(stylePresets.id, p.id) });
    if (!before) return fail(404, "NOT_FOUND", "Preset not found");
    const [row] = await db.update(stylePresets).set(values).where(eq(stylePresets.id, p.id)).returning();
    await writeAudit({ actor, action: "preset.update", targetType: "style_preset", targetId: p.id, before, after: row, meta });
    return ok(row);
  }
  const { id: _id, ...insert } = values;
  const existing = await db.query.stylePresets.findFirst({ where: eq(stylePresets.slug, p.slug) });
  if (existing) return fail(409, "SLUG_TAKEN", "That slug is already used.");
  const [row] = await db.insert(stylePresets).values(insert).returning();
  await writeAudit({ actor, action: "preset.create", targetType: "style_preset", targetId: row!.id, after: row, meta });
  return ok(row);
});

export const DELETE = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const { id } = z.object({ id: z.string().uuid() }).parse(await readJson(req));
  const [row] = await db.delete(stylePresets).where(eq(stylePresets.id, id)).returning();
  await writeAudit({ actor, action: "preset.delete", targetType: "style_preset", targetId: id, before: row ?? null, meta });
  return ok({ ok: true });
});
