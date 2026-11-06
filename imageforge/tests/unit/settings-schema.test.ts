import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/server/settings/defaults";
import { appSettingsSchema, policyRuleInputSchema, settingsExportSchema } from "@/server/settings/schema";

describe("AppSettings schema", () => {
  it("accepts defaults", () => {
    expect(appSettingsSchema.safeParse(defaultSettings()).success).toBe(true);
    expect(appSettingsSchema.safeParse(defaultSettings({ hasRealProvider: true })).success).toBe(true);
  });

  it.each([
    ["top-level", (s: Record<string, unknown>) => ({ ...s, extra: 1 })],
    ["policy", (s: ReturnType<typeof defaultSettings>) => ({ ...s, policy: { ...s.policy, nope: true } })],
    ["nested flags", (s: ReturnType<typeof defaultSettings>) => ({ ...s, access: { ...s.access, flags: { ...s.access.flags, secretFlag: true } } })],
    ["providers", (s: ReturnType<typeof defaultSettings>) => ({ ...s, providers: { ...s.providers, apiKey: "sk-123" } })],
  ])("rejects unknown fields (%s)", (_n, mut) => {
    const res = appSettingsSchema.safeParse(mut(defaultSettings() as never));
    expect(res.success).toBe(false);
  });

  it("validates ranges and formats", () => {
    const s = defaultSettings();
    expect(appSettingsSchema.safeParse({ ...s, generation: { ...s.generation, maxImagesPerRequest: 9 } }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...s, branding: { ...s.branding, accentColor: "red" } }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...s, generation: { ...s.generation, allowedModels: ["evil"] } }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...s, branding: { ...s.branding, logoUrl: "javascript:alert(1)" } }).success).toBe(false);
  });

  it("rule inputs are strict", () => {
    expect(policyRuleInputSchema.safeParse({ kind: "keyword", pattern: "x" }).success).toBe(true);
    expect(policyRuleInputSchema.safeParse({ kind: "keyword", pattern: "x", hard: false }).success).toBe(false);
  });

  it("export envelope is strict", () => {
    const env = { format: "imageforge.settings.v1", exportedAt: new Date().toISOString(), version: 1, settings: defaultSettings(), rules: [] };
    expect(settingsExportSchema.safeParse(env).success).toBe(true);
    expect(settingsExportSchema.safeParse({ ...env, childSafety: false }).success).toBe(false);
  });
});
