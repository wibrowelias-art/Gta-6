import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth, inviteContext } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { invites, user } from "@/server/db/schema";
import { fail, handler, readJson } from "@/server/http";
import { findValidInvite } from "@/server/invites";
import { hit } from "@/server/rate-limit";
import { metaFromHeaders } from "@/server/request";
import { getSettings } from "@/server/settings/store";
import { writeAudit } from "@/server/audit";

const body = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(128),
  inviteToken: z.string().max(200).optional(),
});

export const POST = handler(async (req: Request) => {
  const meta = metaFromHeaders(req.headers);
  const rl = await hit(`signup:${meta.ip ?? "unknown"}`, 10);
  if (!rl.ok) return fail(429, "RATE_LIMITED", "Too many attempts. Try again in a minute.");

  const input = body.parse(await readJson(req));
  const settings = await getSettings();
  const invite = input.inviteToken ? await findValidInvite(input.inviteToken, input.email) : null;
  if (settings.access.inviteOnly && !invite) {
    return fail(403, "INVITE_REQUIRED", "IMAGEFORGE is invite-only right now. Ask for an invite link.");
  }

  const run = () =>
    auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: req.headers,
      asResponse: true,
    });
  const res = invite ? await inviteContext.run({ inviteId: invite.id, email: invite.email }, run) : await run();

  if (res.ok && invite) {
    const created = await db.query.user.findFirst({ where: eq(user.email, input.email) });
    if (created) {
      await db.update(invites).set({ usedAt: new Date(), usedBy: created.id }).where(eq(invites.id, invite.id));
      if (invite.role !== "user") {
        await db.update(user).set({ role: invite.role }).where(eq(user.id, created.id));
      }
      await writeAudit({ actor: { id: created.id, email: created.email }, action: "invite.redeemed", targetType: "invite", targetId: invite.id, after: { role: invite.role }, meta });
    }
  }
  if (!res.ok) {
    const data = (await res.clone().json().catch(() => null)) as { message?: string; code?: string } | null;
    const msg = data?.code === "USER_ALREADY_EXISTS" || /exist/i.test(data?.message ?? "") ? "An account with this email already exists." : (data?.message ?? "Could not create account.");
    return fail(res.status, data?.code ?? "SIGN_UP_FAILED", msg);
  }
  return res;
});
