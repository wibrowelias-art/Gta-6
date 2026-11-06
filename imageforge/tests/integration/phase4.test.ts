import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import { auditLog, generationJobs, images, stylePresets, user } from "@/server/db/schema";
import { runGeneration } from "@/server/pipeline/generate";
import { __setProviderOverrides } from "@/server/providers/registry";
import { stubProvider } from "@/server/providers/stub";
import type { ImageProvider } from "@/server/providers/types";
import { runRetention } from "@/server/retention";
import { patchSettings } from "@/server/settings/admin";
import { getSettings } from "@/server/settings/store";
import { applyUserAction } from "@/server/users-admin";
import { hasDb, makeUser, resetDb } from "../support/db";

const meta = { ip: "10.0.0.2", userAgent: "vitest" };

describe.skipIf(!hasDb)("presets, watermark, retention, users admin", () => {
  let gen: ReturnType<typeof vi.fn<ImageProvider["generate"]>>;
  beforeEach(async () => {
    await resetDb();
    gen = vi.fn<ImageProvider["generate"]>((r) => stubProvider.generate(r));
    __setProviderOverrides({ stub: { ...stubProvider, generate: gen } });
  });
  afterEach(() => __setProviderOverrides(undefined));

  async function useStubOnly() {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await patchSettings(dev, meta, { providers: { ...s.providers, enabled: { openai: false, gemini: false, stub: true } } });
    return dev;
  }

  it("preset prefix/suffix change what the provider receives; policy sees the combined prompt", async () => {
    await useStubOnly();
    await db.insert(stylePresets).values({ slug: "noir", name: "Noir", promptPrefix: "black and white film noir", promptSuffix: "hard shadows" });
    const u = await makeUser();
    const out = await runGeneration(u as never, meta, { prompt: "a detective in rain", preset: "noir" });
    expect(out.status).toBe("succeeded");
    expect(gen.mock.calls[0]![0].prompt).toBe("black and white film noir, a detective in rain, hard shadows");

    await db.insert(stylePresets).values({ slug: "bad", name: "Bad", promptSuffix: "nazi propaganda" });
    const blocked = await runGeneration(u as never, meta, { prompt: "a poster", preset: "bad" });
    expect(blocked.status).toBe("blocked");
    expect(gen).toHaveBeenCalledTimes(1);

    await db.update(stylePresets).set({ enabled: false }).where(eq(stylePresets.slug, "noir"));
    await expect(runGeneration(u as never, meta, { prompt: "x", preset: "noir" })).rejects.toMatchObject({ code: "PRESET_NOT_FOUND" });
  });

  it("watermarks stored images when enabled", async () => {
    const dev = await useStubOnly();
    const s = await getSettings();
    await patchSettings(dev, meta, { generation: { ...s.generation, watermark: { ...s.generation.watermark, enabled: true } } });
    const u = await makeUser();
    await runGeneration(u as never, meta, { prompt: "a meadow" });
    const [img] = await db.select().from(images).where(eq(images.userId, u.id));
    expect(img?.watermarked).toBe(true);
  });

  it("negative prompt only passes through when the flag is on", async () => {
    const dev = await useStubOnly();
    const u = await makeUser();
    await runGeneration(u as never, meta, { prompt: "a cat", negativePrompt: "dogs" });
    expect(gen.mock.calls[0]![0].negativePrompt).toBe("dogs");
    const s = await getSettings();
    await patchSettings(dev, meta, { access: { ...s.access, flags: { ...s.access.flags, negativePrompt: false, remix: false } } });
    await runGeneration(u as never, meta, { prompt: "a cat", negativePrompt: "dogs" });
    expect(gen.mock.calls[1]![0].negativePrompt).toBeNull();
    await expect(runGeneration(u as never, meta, { prompt: "a cat", remixOf: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({ code: "REMIX_DISABLED" });
  });

  it("retention deletes old images and their blobs", async () => {
    const dev = await useStubOnly();
    const u = await makeUser();
    await runGeneration(u as never, meta, { prompt: "old one" });
    await runGeneration(u as never, meta, { prompt: "new one" });
    const rows = await db.select().from(images).where(eq(images.userId, u.id));
    const old = rows[0]!;
    await db.update(images).set({ createdAt: new Date(Date.now() - 100 * 86400_000), expiresAt: null }).where(eq(images.id, old.id));
    const file = path.resolve(process.env.IMAGEFORGE_STORAGE_DIR!, old.storageKey.slice(6));
    expect(existsSync(file)).toBe(true);
    const s = await getSettings();
    await patchSettings(dev, meta, { generation: { ...s.generation, retentionDays: 30 } });
    const res = await runRetention();
    expect(res.deleted).toBe(1);
    expect(existsSync(file)).toBe(false);
    expect((await db.select().from(images).where(eq(images.userId, u.id))).length).toBe(1);
  });

  it("users admin: no self-demote, promote, ban, wipe; all audited", async () => {
    const dev = await makeUser("developer");
    const u = await makeUser();
    await expect(applyUserAction(dev, meta, { action: "set_role", userId: dev.id, role: "user" })).rejects.toMatchObject({ code: "SELF_DEMOTE" });
    await applyUserAction(dev, meta, { action: "set_role", userId: u.id, role: "developer" });
    expect((await db.query.user.findFirst({ where: eq(user.id, u.id) }))?.role).toBe("developer");
    await applyUserAction(dev, meta, { action: "set_role", userId: u.id, role: "user" });
    await applyUserAction(dev, meta, { action: "ban", userId: u.id, reason: "spam" });
    expect((await db.query.user.findFirst({ where: eq(user.id, u.id) }))?.banned).toBe(true);
    await useStubOnly();
    const u2 = await makeUser();
    await runGeneration(u2 as never, meta, { prompt: "a" });
    const r = await applyUserAction(dev, meta, { action: "wipe_generations", userId: u2.id });
    expect(r).toMatchObject({ deleted: 1 });
    expect(await db.select().from(images).where(eq(images.userId, u2.id))).toHaveLength(0);
    expect(await db.select().from(generationJobs).where(eq(generationJobs.userId, u2.id))).toHaveLength(1);
    const actions = (await db.select({ a: auditLog.action }).from(auditLog)).map((x) => x.a);
    expect(actions).toEqual(expect.arrayContaining(["user.set_role", "user.ban", "user.wipe_generations"]));
  });
});
