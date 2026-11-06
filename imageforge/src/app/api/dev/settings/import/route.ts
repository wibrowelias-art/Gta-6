import { requireDevApi } from "@/server/auth/guards";
import { fail, handler, ok, readJson } from "@/server/http";
import { replaceSettings } from "@/server/settings/admin";
import { settingsExportSchema } from "@/server/settings/schema";

export const POST = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const parsed = settingsExportSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(400, "INVALID_SETTINGS", "That file is not a valid IMAGEFORGE settings export.", parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const cfg = await replaceSettings(actor, meta, parsed.data.settings, parsed.data.rules, `import of v${parsed.data.version}`, "settings.import");
  return ok({ version: cfg.version });
});
