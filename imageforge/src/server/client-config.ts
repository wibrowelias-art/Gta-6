import "server-only";
import { asc, eq } from "drizzle-orm";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { stylePresets } from "@/server/db/schema";
import { getProvider, splitModelId } from "@/server/providers/registry";
import { getUsage } from "@/server/quota";
import { getSettings } from "@/server/settings/store";

/** Everything the create UI needs — and nothing secret (no preset prefixes/suffixes, no keys, no policy rules). */
export async function getClientConfig(user: CurrentUser) {
  const s = await getSettings();
  const [presets, usage] = await Promise.all([
    db
      .select({ slug: stylePresets.slug, name: stylePresets.name, thumbnailUrl: stylePresets.thumbnailUrl })
      .from(stylePresets)
      .where(eq(stylePresets.enabled, true))
      .orderBy(asc(stylePresets.sortOrder), asc(stylePresets.name)),
    getUsage(user, s),
  ]);
  const models = s.generation.allowedModels
    .map((id) => ({ id, ...splitModelId(id) }))
    .filter((m) => s.providers.enabled[m.provider] && getProvider(m.provider).isConfigured())
    .map((m) => ({ id: m.id, label: m.provider === "stub" ? "Stub (offline)" : m.model }));
  return {
    aspectRatios: s.generation.aspectRatios,
    maxImages: Math.min(s.generation.maxImagesPerRequest, user.role === "user" ? usage.maxImagesPerRequest : 4),
    maxPromptLength: s.generation.maxPromptLength,
    flags: { negativePrompt: s.access.flags.negativePrompt, remix: s.access.flags.remix, publicShare: s.access.flags.publicShare },
    models,
    defaultModel: models.some((m) => m.id === s.generation.defaultModel) ? s.generation.defaultModel : (models[0]?.id ?? s.generation.defaultModel),
    presets,
    usage: { remaining: usage.remaining, limits: usage.limits, used: usage.used },
  };
}
export type ClientConfig = Awaited<ReturnType<typeof getClientConfig>>;
