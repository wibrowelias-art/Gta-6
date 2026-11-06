import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { invites } from "@/server/db/schema";
import { env } from "@/server/env";
import { handler, ok, readJson } from "@/server/http";
import { createInvite } from "@/server/invites";

const body = z.object({
  email: z.union([z.literal(""), z.string().email()]).optional(),
  role: z.enum(["user", "moderator", "developer"]).default("user"),
  days: z.number().int().min(1).max(90).default(7),
});

export const POST = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const b = body.parse(await readJson(req));
  const { invite, token } = await createInvite({ email: b.email || null, role: b.role, createdBy: actor.id, days: b.days });
  await writeAudit({ actor, action: "invite.create", targetType: "invite", targetId: invite.id, after: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, meta });
  return ok({ id: invite.id, url: `${env.APP_URL}/sign-up?invite=${encodeURIComponent(token)}` });
});

const del = z.object({ id: z.string().uuid() });

export const DELETE = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const { id } = del.parse(await readJson(req));
  const [row] = await db.delete(invites).where(eq(invites.id, id)).returning();
  await writeAudit({ actor, action: "invite.revoke", targetType: "invite", targetId: id, before: row ? { email: row.email, role: row.role } : null, meta });
  return ok({ ok: true });
});
