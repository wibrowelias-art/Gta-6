import "server-only";
import { env, keyStatus } from "@/server/env";
import { assertChildSafe } from "@/server/policy/child-safety";
import type { AppSettings, ProviderId } from "@/server/settings/schema";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { stubProvider } from "./stub";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

const PROVIDERS: Record<ProviderId, ImageProvider> = { openai: openaiProvider, gemini: geminiProvider, stub: stubProvider };

/** Test seam: lets integration tests swap in fake providers without touching the network. */
const g = globalThis as unknown as { __ifProviderOverrides?: Partial<Record<ProviderId, ImageProvider>> };
export function __setProviderOverrides(o: Partial<Record<ProviderId, ImageProvider>> | undefined) {
  g.__ifProviderOverrides = o;
}

export function getProvider(id: ProviderId): ImageProvider {
  return g.__ifProviderOverrides?.[id] ?? PROVIDERS[id];
}

export function splitModelId(id: string): { provider: ProviderId; model: string } {
  const [p, ...rest] = id.split(":");
  return { provider: p as ProviderId, model: rest.join(":") };
}

/**
 * Ordered attempt list: the requested model's provider first, then the fallback
 * order. Disabled or unconfigured providers are skipped (not counted as attempts).
 */
export function planAttempts(settings: AppSettings, requestedModelId: string): { provider: ProviderId; model: string }[] {
  const req = splitModelId(requestedModelId);
  const out: { provider: ProviderId; model: string }[] = [];
  const usable = (p: ProviderId) => settings.providers.enabled[p] && getProvider(p).isConfigured();
  if (usable(req.provider)) out.push(req);
  for (const p of settings.providers.order) {
    if (out.some((o) => o.provider === p) || !usable(p)) continue;
    const m = settings.generation.allowedModels.map(splitModelId).find((x) => x.provider === p);
    out.push({ provider: p, model: m?.model ?? getProvider(p).knownModels[0]! });
  }
  return out;
}

/**
 * The ONLY way the app calls an image provider. Re-runs the child-safety hard
 * block on the exact text being sent, immediately before the network call.
 */
export async function callProvider(provider: ProviderId, req: GenerateRequest): Promise<GenerateResult> {
  assertChildSafe(req.prompt, req.negativePrompt);
  return getProvider(provider).generate(req);
}

export function providerStatus(settings: AppSettings) {
  const keys: Record<ProviderId, string | undefined> = { openai: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY, stub: "offline" };
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    knownModels: PROVIDERS[id].knownModels,
    enabled: settings.providers.enabled[id],
    configured: PROVIDERS[id].isConfigured(),
    key: id === "stub" ? { set: true, hint: "no key needed" } : keyStatus(keys[id]),
    costPerImageUsd: settings.providers.costPerImageUsd[id],
  }));
}
