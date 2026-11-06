import { z } from "zod";
import { requireDevApi } from "@/server/auth/guards";
import { handler, ok, readJson } from "@/server/http";
import { patchSettings, replaceSettings } from "@/server/settings/admin";
import { getConfigUncached, listSettingsVersions, SETTINGS_TTL_MS } from "@/server/settings/store";

export const GET = handler(async (req: Request) => {
  await requireDevApi(req);
  const [cfg, versions] = await Promise.all([getConfigUncached(), listSettingsVersions()]);
  return ok({ version: cfg.version, settings: cfg.settings, rules: cfg.rules, versions, cacheTtlMs: SETTINGS_TTL_MS });
});

const patchBody = z.object({ patch: z.unknown(), note: z.string().max(200).optional() });

/** PATCH { patch: { access: {...} } } — replaces whole top-level sections. */
export const PATCH = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const body = patchBody.parse(await readJson(req));
  const cfg = await patchSettings(actor, meta, body.patch, body.note);
  return ok({ version: cfg.version, settings: cfg.settings });
});

const putBody = z.object({ settings: z.unknown(), note: z.string().max(200).optional() });

/** PUT { settings } — full replacement, validated strictly. */
export const PUT = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const body = putBody.parse(await readJson(req));
  const cfg = await replaceSettings(actor, meta, body.settings, undefined, body.note);
  return ok({ version: cfg.version, settings: cfg.settings });
});
