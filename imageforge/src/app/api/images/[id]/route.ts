import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { userFromHeaders } from "@/server/auth/session";
import { requireApiUser } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { images } from "@/server/db/schema";
import { fail, handler, ok, readJson } from "@/server/http";
import { getSettings } from "@/server/settings/store";
import { storageFor } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

/** Auth-checked image proxy. Private by default; public only via share flag + per-image opt-in. */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "NOT_FOUND", "Not found");
  const img = await db.query.images.findFirst({ where: and(eq(images.id, id.data), isNull(images.deletedAt)) });
  if (!img) return fail(404, "NOT_FOUND", "Not found");
  const viewer = await userFromHeaders(req.headers);
  const owner = viewer && (viewer.id === img.userId || viewer.role === "developer");
  if (!owner) {
    const s = await getSettings();
    if (!(img.isPublic && s.access.flags.publicShare)) return fail(404, "NOT_FOUND", "Not found");
  }
  const obj = await storageFor(img.storageKey).get(img.storageKey);
  if (!obj) return fail(404, "NOT_FOUND", "Not found");
  const download = new URL(req.url).searchParams.get("download") === "1";
  const ext = img.mime.split("/")[1] ?? "png";
  const body: BodyInit = Buffer.isBuffer(obj.body) ? new Uint8Array(obj.body) : (obj.body as ReadableStream);
  return new Response(body, {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": owner ? "private, max-age=31536000, immutable" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="imageforge-${img.id.slice(0, 8)}.${ext}"` } : {}),
    },
  });
});

const patch = z.object({ favorite: z.boolean().optional(), isPublic: z.boolean().optional() });

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { user } = await requireApiUser(req);
  const id = idSchema.parse((await ctx.params).id);
  const body = patch.parse(await readJson(req));
  const img = await db.query.images.findFirst({ where: and(eq(images.id, id), eq(images.userId, user.id), isNull(images.deletedAt)) });
  if (!img) return fail(404, "NOT_FOUND", "Not found");
  const update: Partial<typeof images.$inferInsert> = {};
  if (body.favorite !== undefined) update.favorite = body.favorite;
  if (body.isPublic !== undefined) {
    const s = await getSettings();
    if (body.isPublic && !s.access.flags.publicShare) return fail(403, "SHARE_DISABLED", "Sharing is turned off.");
    update.isPublic = body.isPublic;
    if (body.isPublic && !img.shareSlug) update.shareSlug = randomBytes(9).toString("base64url");
  }
  const [row] = await db.update(images).set(update).where(eq(images.id, id)).returning();
  return ok({ id: row!.id, favorite: row!.favorite, isPublic: row!.isPublic, shareSlug: row!.shareSlug });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const { user } = await requireApiUser(req);
  const id = idSchema.parse((await ctx.params).id);
  const [row] = await db.delete(images).where(and(eq(images.id, id), eq(images.userId, user.id))).returning();
  if (!row) return fail(404, "NOT_FOUND", "Not found");
  await storageFor(row.storageKey).delete(row.storageKey).catch((e) => console.error("[storage] delete failed", e));
  return ok({ ok: true });
});
