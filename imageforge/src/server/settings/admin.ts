import "server-only";
import { z } from "zod";
import { writeAudit, type Actor } from "@/server/audit";
import { HttpError } from "@/server/http";
import type { ReqMeta } from "@/server/request";
import { appSettingsSchema } from "./schema";
import { getConfigUncached, ruleRowToInput, saveConfig, SettingsValidationError } from "./store";

const SECTIONS = Object.keys(appSettingsSchema.shape) as (keyof typeof appSettingsSchema.shape)[];
/** Patch replaces whole top-level sections; unknown sections are rejected (strict). */
export const settingsPatchSchema = z.strictObject(Object.fromEntries(SECTIONS.map((k) => [k, z.unknown().optional()])) as Record<string, z.ZodOptional<z.ZodUnknown>>);

async function persist(actor: Actor, meta: ReqMeta, action: string, input: { settings: unknown; rules?: unknown[]; note?: string }) {
  const before = await getConfigUncached();
  try {
    const after = await saveConfig({ ...input, actorId: actor.id });
    await writeAudit({
      actor,
      action,
      targetType: "app_settings",
      targetId: String(after.version),
      before: { version: before.version, settings: before.settings, rules: input.rules ? before.rules.map(ruleRowToInput) : undefined },
      after: { version: after.version, settings: after.settings, rules: input.rules ? after.rules.map(ruleRowToInput) : undefined },
      meta,
    });
    return after;
  } catch (e) {
    if (e instanceof SettingsValidationError) throw new HttpError(400, "INVALID_SETTINGS", "Settings are invalid.", e.issues);
    throw e;
  }
}

export async function patchSettings(actor: Actor, meta: ReqMeta, patch: unknown, note?: string) {
  const p = settingsPatchSchema.safeParse(patch);
  if (!p.success) throw new HttpError(400, "INVALID_SETTINGS", "Unknown settings section.", p.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  const current = await getConfigUncached();
  const merged = { ...current.settings, ...Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== undefined)) };
  return persist(actor, meta, "settings.update", { settings: merged, note: note ?? `update ${Object.keys(p.data).join(", ")}` });
}

export async function replaceSettings(actor: Actor, meta: ReqMeta, settings: unknown, rules?: unknown[], note?: string, action = "settings.replace") {
  return persist(actor, meta, action, { settings, rules, note });
}

export async function replaceRules(actor: Actor, meta: ReqMeta, rules: unknown[]) {
  const current = await getConfigUncached();
  return persist(actor, meta, "policy.rules.update", { settings: current.settings, rules, note: "rules update" });
}
