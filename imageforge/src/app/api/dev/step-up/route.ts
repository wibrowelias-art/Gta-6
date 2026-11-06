import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { availableStepUpMethods, clearStepUp, grantStepUp, stepUpExpiresAt, verifyStepUp } from "@/server/auth/step-up";
import { fail, handler, ok, readJson } from "@/server/http";
import { hit } from "@/server/rate-limit";

export const GET = handler(async (req: Request) => {
  const { user } = await requireDevApi(req);
  return ok({ expiresAt: await stepUpExpiresAt(user.id), methods: await availableStepUpMethods(user.id) });
});

const body = z.object({ method: z.enum(["pin", "totp", "password"]), code: z.string().min(1).max(200) });

export const POST = handler(async (req: Request) => {
  const { user, meta, actor } = await requireDevApi(req);
  const rl = await hit(`stepup:${user.id}`, 5);
  if (!rl.ok) return fail(429, "RATE_LIMITED", "Too many attempts. Wait a minute.");
  const { method, code } = body.parse(await readJson(req));
  const valid = await verifyStepUp(user.id, method, code);
  await writeAudit({ actor, action: valid ? "dev.step_up.success" : "dev.step_up.failure", targetType: "user", targetId: user.id, after: { method }, meta });
  if (!valid) return fail(401, "STEP_UP_INVALID", "That code didn’t match.");
  const expiresAt = await grantStepUp(user.id);
  return ok({ expiresAt });
});

export const DELETE = handler(async (req: Request) => {
  await requireDevApi(req);
  await clearStepUp();
  return ok({ ok: true });
});
