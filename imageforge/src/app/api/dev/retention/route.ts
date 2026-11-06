import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { handler, ok } from "@/server/http";
import { runRetention } from "@/server/retention";

export const POST = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const result = await runRetention();
  await writeAudit({ actor, action: "retention.run_manual", targetType: "images", after: result, meta });
  return ok(result);
});
