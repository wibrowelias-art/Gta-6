import { z } from "zod";
import { requireDevApi } from "@/server/auth/guards";
import { handler, ok, readJson } from "@/server/http";
import { replaceRules } from "@/server/settings/admin";

const body = z.object({ rules: z.array(z.unknown()).max(5000) });

export const PUT = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const { rules } = body.parse(await readJson(req));
  const cfg = await replaceRules(actor, meta, rules);
  return ok({ version: cfg.version, rules: cfg.rules });
});
