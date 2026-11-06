import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { handler } from "@/server/http";
import { getConfigUncached, ruleRowToInput } from "@/server/settings/store";

export const GET = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const cfg = await getConfigUncached();
  const body = {
    format: "imageforge.settings.v1",
    exportedAt: new Date().toISOString(),
    version: cfg.version,
    settings: cfg.settings,
    rules: cfg.rules.map((r) => {
      const { id: _id, ...rest } = ruleRowToInput(r);
      return rest;
    }),
  };
  await writeAudit({ actor, action: "settings.export", targetType: "app_settings", targetId: String(cfg.version), meta });
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="imageforge-settings-v${cfg.version}.json"`, "Cache-Control": "no-store" },
  });
});
