import { safeEqual } from "@/server/auth/crypto";
import { writeAudit } from "@/server/audit";
import { env } from "@/server/env";
import { fail, handler, ok } from "@/server/http";
import { runRetention } from "@/server/retention";

export const maxDuration = 300;

/** Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`. */
export const GET = handler(async (req: Request) => {
  const secret = env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const result = await runRetention();
  await writeAudit({ actor: null, action: "retention.run", targetType: "images", after: result });
  return ok(result);
});
