import { count, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { generationJobs, images, refusalEvents, usageCounters } from "@/server/db/schema";
import { runGeneration } from "@/server/pipeline/generate";
import { ChildSafetyViolation } from "@/server/policy/child-safety";
import { __setProviderOverrides, callProvider } from "@/server/providers/registry";
import { stubProvider } from "@/server/providers/stub";
import type { ImageProvider } from "@/server/providers/types";
import { patchSettings, replaceRules } from "@/server/settings/admin";
import { getSettings } from "@/server/settings/store";
import { hasDb, makeUser, resetDb } from "../support/db";

const meta = { ip: "10.0.0.1", userAgent: "vitest" };

function spyProvider(id: "openai" | "gemini" | "stub", impl?: ImageProvider["generate"]) {
  const generate = vi.fn(impl ?? ((req) => stubProvider.generate(req)));
  const p: ImageProvider = { id, label: id, knownModels: [id === "openai" ? "gpt-image-1" : id === "gemini" ? "imagen-4.0-generate-001" : "stub-v1"], isConfigured: () => true, generate };
  return { p, generate };
}

async function imageCount(userId: string) {
  const [r] = await db.select({ n: count() }).from(images).where(eq(images.userId, userId));
  return r?.n ?? 0;
}
async function used(userId: string) {
  const rows = await db.select().from(usageCounters).where(eq(usageCounters.userId, userId));
  return rows.find((r) => r.periodType === "day")?.used ?? 0;
}

describe.skipIf(!hasDb)("generation pipeline", () => {
  let openai: ReturnType<typeof spyProvider>;
  let stub: ReturnType<typeof spyProvider>;

  beforeEach(async () => {
    await resetDb();
    openai = spyProvider("openai");
    stub = spyProvider("stub");
    __setProviderOverrides({ openai: openai.p, stub: stub.p, gemini: spyProvider("gemini").p });
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, {
      providers: { ...s.providers, order: ["openai", "stub", "gemini"], enabled: { openai: true, gemini: false, stub: true } },
      generation: { ...s.generation, defaultModel: "openai:gpt-image-1" },
    });
  });
  afterEach(() => __setProviderOverrides(undefined));

  it("generates, stores images and consumes quota", async () => {
    const u = await makeUser();
    const out = await runGeneration(u as never, meta, { prompt: "a quiet harbour at dawn", count: 2, aspectRatio: "1:1" });
    expect(out.status).toBe("succeeded");
    expect(openai.generate).toHaveBeenCalledOnce();
    expect(await imageCount(u.id)).toBe(2);
    expect(await used(u.id)).toBe(2);
  });

  it("blocked prompt: custom refusal, NO provider call, no image, no quota, refusal event logged", async () => {
    const dev = await makeUser("developer");
    await replaceRules(dev, meta, [{ kind: "keyword", pattern: "dragon", category: "no_dragons", action: "block" }]);
    const s = await getSettings();
    await patchSettings(dev, meta, { policy: { ...s.policy, refusalMessage: "Nope — not here." } });
    const u = await makeUser();
    const out = await runGeneration(u as never, meta, { prompt: "a red DRAGON over a city", count: 1 });
    expect(out).toMatchObject({ status: "blocked", message: "Nope — not here." });
    expect(openai.generate).not.toHaveBeenCalled();
    expect(stub.generate).not.toHaveBeenCalled();
    expect(await imageCount(u.id)).toBe(0);
    expect(await used(u.id)).toBe(0);
    const ev = await db.select().from(refusalEvents).where(eq(refusalEvents.userId, u.id));
    expect(ev.map((e) => e.category)).toEqual(["no_dragons"]);
    expect(ev[0]?.excerpt).toBeNull(); // only hash stored for normal refusals
  });

  it("child safety blocks on every path, including remix and break-glass dry-run", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { devTools: { breakGlass: true } });
    const u = await makeUser();
    const r1 = await runGeneration(u as never, meta, { prompt: "sexy schoolgirl", count: 1 });
    const r2 = await runGeneration(u as never, meta, { prompt: "naked toddler", count: 1, remixOf: "00000000-0000-4000-8000-000000000000" });
    const r3 = await runGeneration(dev as never, meta, { prompt: "n a k e d c h i l d", count: 1 }, { source: "dry-run", breakGlass: true });
    for (const r of [r1, r2, r3]) expect(r.status).toBe("blocked");
    expect(openai.generate).not.toHaveBeenCalled();
    expect(stub.generate).not.toHaveBeenCalled();
    const hard = await db.select().from(refusalEvents).where(eq(refusalEvents.hard, true));
    expect(hard).toHaveLength(3);
    expect(s.devTools).toBeDefined();
  });

  it("break-glass dry-run bypasses configurable rules only", async () => {
    const dev = await makeUser("developer");
    await replaceRules(dev, meta, [{ kind: "keyword", pattern: "dragon" }]);
    await patchSettings(dev, meta, { devTools: { breakGlass: true } });
    const ok = await runGeneration(dev as never, meta, { prompt: "dragon", count: 1 }, { source: "dry-run", breakGlass: true });
    expect(ok.status).toBe("succeeded");
    const normal = await runGeneration(dev as never, meta, { prompt: "dragon", count: 1 });
    expect(normal.status).toBe("blocked");
  });

  it("second child-safety gate: callProvider refuses unsafe text before touching the provider", async () => {
    await expect(callProvider("openai", { prompt: "portrait", negativePrompt: "nude child", aspectRatio: "1:1", count: 1, model: "gpt-image-1", signal: AbortSignal.timeout(1000) })).rejects.toBeInstanceOf(
      ChildSafetyViolation,
    );
    expect(openai.generate).not.toHaveBeenCalled();
  });

  it("retries once on the fallback provider, then succeeds", async () => {
    openai.generate.mockRejectedValueOnce(new Error("boom"));
    const u = await makeUser();
    const out = await runGeneration(u as never, meta, { prompt: "a fox in snow", count: 1 });
    expect(out.status).toBe("succeeded");
    if (out.status === "succeeded") expect(out.provider).toBe("stub");
    expect(openai.generate).toHaveBeenCalledOnce();
    expect(stub.generate).toHaveBeenCalledOnce();
  });

  it("fails with a user-safe error after one fallback; no quota used", async () => {
    openai.generate.mockRejectedValue(new Error("secret internal detail"));
    stub.generate.mockRejectedValue(new Error("also bad"));
    const u = await makeUser();
    await expect(runGeneration(u as never, meta, { prompt: "a fox in snow", count: 1 })).rejects.toMatchObject({ code: "GENERATION_FAILED", message: expect.not.stringContaining("secret") });
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.userId, u.id));
    expect(job?.status).toBe("failed");
    expect(job?.attempt).toBe(2);
    expect(await used(u.id)).toBe(0);
  });

  it("disabled provider is skipped", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { providers: { ...s.providers, enabled: { ...s.providers.enabled, openai: false } } });
    const u = await makeUser();
    const out = await runGeneration(u as never, meta, { prompt: "a fox in snow", count: 1 });
    expect(out.status === "succeeded" && out.provider).toBe("stub");
    expect(openai.generate).not.toHaveBeenCalled();
  });

  it("enforces daily quota set live by the developer", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { quotas: { byRole: { ...s.quotas.byRole, user: { daily: 5, monthly: 100 } } } });
    const u = await makeUser();
    await runGeneration(u as never, meta, { prompt: "a", count: 4 });
    await expect(runGeneration(u as never, meta, { prompt: "b", count: 2 })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    await runGeneration(u as never, meta, { prompt: "c", count: 1 });
    await expect(runGeneration(u as never, meta, { prompt: "d", count: 1 })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(await used(u.id)).toBe(5);
  });

  it("validates against live generation settings", async () => {
    const u = await makeUser();
    await expect(runGeneration(u as never, meta, { prompt: "x".repeat(1001) })).rejects.toMatchObject({ code: "PROMPT_TOO_LONG" });
    await expect(runGeneration(u as never, meta, { prompt: "x", aspectRatio: "2:3" })).rejects.toMatchObject({ code: "ASPECT_NOT_ALLOWED" });
    await expect(runGeneration(u as never, meta, { prompt: "x", model: "openai:dall-e-2" })).rejects.toMatchObject({ code: "MODEL_NOT_ALLOWED" });
  });

  it("maintenance mode blocks users but not developers", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { access: { ...s.access, maintenance: { enabled: true, message: "brb" } } });
    const u = await makeUser();
    await expect(runGeneration(u as never, meta, { prompt: "x" })).rejects.toMatchObject({ code: "MAINTENANCE", message: "brb" });
    expect((await runGeneration(dev as never, meta, { prompt: "x" })).status).toBe("succeeded");
  });

  it("rate limits per user", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { access: { ...s.access, rateLimits: { perIpPerMin: 100, perUserPerMin: 2 } } });
    const u = await makeUser();
    await runGeneration(u as never, meta, { prompt: "a" });
    await runGeneration(u as never, meta, { prompt: "b" });
    await expect(runGeneration(u as never, meta, { prompt: "c" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
