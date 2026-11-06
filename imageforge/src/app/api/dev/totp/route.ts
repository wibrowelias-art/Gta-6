import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { beginTotpEnrollment, confirmTotpEnrollment } from "@/server/auth/step-up";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema";
import { fail, handler, ok, readJson } from "@/server/http";

/** Start TOTP enrollment (requires an active step-up). */
export const POST = handler(async (req: Request) => {
  const { user, meta, actor } = await requireDevApi(req, { stepUp: true });
  const { secret, uri } = await beginTotpEnrollment(user.id, user.email);
  await writeAudit({ actor, action: "dev.totp.enroll_started", targetType: "user", targetId: user.id, meta });
  return ok({ secret, uri });
});

const confirm = z.object({ code: z.string().min(6).max(10) });

export const PUT = handler(async (req: Request) => {
  const { user, meta, actor } = await requireDevApi(req, { stepUp: true });
  const { code } = confirm.parse(await readJson(req));
  const okCode = await confirmTotpEnrollment(user.id, code);
  if (!okCode) return fail(400, "TOTP_INVALID", "That code didn’t match. Check your authenticator clock.");
  await writeAudit({ actor, action: "dev.totp.enabled", targetType: "user", targetId: user.id, meta });
  return ok({ enabled: true });
});

export const DELETE = handler(async (req: Request) => {
  const { user, meta, actor } = await requireDevApi(req, { stepUp: true });
  await db.update(userTable).set({ devTotpEnabled: false, devTotpSecret: null }).where(eq(userTable.id, user.id));
  await writeAudit({ actor, action: "dev.totp.disabled", targetType: "user", targetId: user.id, meta });
  return ok({ enabled: false });
});
