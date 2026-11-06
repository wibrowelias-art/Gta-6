import { z } from "zod";

/**
 * AppSettings — the single live-editable configuration blob, versioned in
 * `app_settings`. Every object is strict: unknown keys are rejected on save
 * and on import. There is deliberately NO field for child-safety: that
 * protection lives in code (src/server/policy/child-safety.ts) and cannot be
 * configured, disabled, or bypassed through settings.
 */

export const PROVIDER_IDS = ["openai", "gemini", "stub"] as const;
export const providerIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const POLICY_CATEGORIES = ["violence", "weapons", "hate", "scams", "doxxing", "drugs"] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

import { ALL_ASPECT_RATIOS } from "@/lib/constants";
export { ALL_ASPECT_RATIOS };
export const aspectRatioSchema = z.enum(ALL_ASPECT_RATIOS);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

const level = z.enum(["off", "warn", "block"]);
const modelId = z.string().regex(/^(openai|gemini|stub):[A-Za-z0-9._-]{1,80}$/, "Model ids look like provider:model");
const quota = z.strictObject({
  daily: z.number().int().min(0).max(1_000_000),
  monthly: z.number().int().min(0).max(10_000_000),
});
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color");
const httpsUrlOrEmpty = z.union([z.literal(""), z.string().url().max(500).refine((u) => /^https?:\/\//.test(u), "http(s) only")]);

export const appSettingsSchema = z.strictObject({
  policy: z.strictObject({
    allowlistMode: z.boolean(),
    allowedTopics: z.array(z.string().min(1).max(80)).max(500),
    realFaces: z.strictObject({ enabled: z.boolean(), severity: z.enum(["warn", "block"]) }),
    categories: z.strictObject({
      violence: level,
      weapons: level,
      hate: level,
      scams: level,
      doxxing: level,
      drugs: level,
    }),
    brandImpersonation: z.boolean(),
    refusalMessage: z.string().min(1).max(500),
    safeRewrite: z.boolean(),
  }),
  generation: z.strictObject({
    defaultModel: modelId,
    allowedModels: z.array(modelId).min(1).max(30),
    maxImagesPerRequest: z.number().int().min(1).max(4),
    maxPromptLength: z.number().int().min(20).max(4000),
    maxConcurrentJobsPerUser: z.number().int().min(1).max(20),
    aspectRatios: z.array(aspectRatioSchema).min(1),
    watermark: z.strictObject({
      enabled: z.boolean(),
      text: z.string().max(60),
      opacity: z.number().min(0.05).max(1),
      position: z.enum(["br", "bl", "tr", "tl", "center"]),
    }),
    retentionDays: z.number().int().min(0).max(3650), // 0 = keep forever
    providerTimeoutMs: z.number().int().min(5_000).max(120_000),
  }),
  quotas: z.strictObject({
    byRole: z.strictObject({ user: quota, moderator: quota, developer: quota }),
  }),
  access: z.strictObject({
    inviteOnly: z.boolean(),
    maintenance: z.strictObject({ enabled: z.boolean(), message: z.string().max(500) }),
    flags: z.strictObject({
      publicShare: z.boolean(),
      remix: z.boolean(),
      apiAccess: z.boolean(),
      negativePrompt: z.boolean(),
      img2img: z.boolean(),
    }),
    rateLimits: z.strictObject({
      perIpPerMin: z.number().int().min(1).max(10_000),
      perUserPerMin: z.number().int().min(1).max(10_000),
    }),
    allowedOrigins: z.array(z.string().url().max(200)).max(50),
  }),
  branding: z.strictObject({
    appName: z.string().min(1).max(40),
    logoUrl: httpsUrlOrEmpty,
    accentColor: hexColor,
    customCss: z.string().max(5000),
    footerLinks: z.array(z.strictObject({ label: z.string().min(1).max(40), url: z.string().url().max(500) })).max(10),
    supportEmail: z.union([z.literal(""), z.string().email()]),
  }),
  providers: z.strictObject({
    order: z.array(providerIdSchema).min(1),
    enabled: z.strictObject({ openai: z.boolean(), gemini: z.boolean(), stub: z.boolean() }),
    costPerImageUsd: z.strictObject({
      openai: z.number().min(0).max(10),
      gemini: z.number().min(0).max(10),
      stub: z.number().min(0).max(10),
    }),
  }),
  devTools: z.strictObject({
    /** Lets a developer run configurable-policy-bypassed generations from the Dry-run tool. Child safety still applies. */
    breakGlass: z.boolean(),
  }),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const policyRuleInputSchema = z.strictObject({
  id: z.string().uuid().optional(),
  kind: z.enum(["keyword", "regex", "category", "allow"]),
  pattern: z.string().min(1).max(500),
  category: z.string().max(60).nullable().optional(),
  action: z.enum(["allow", "warn", "block"]).default("block"),
  severity: z.number().int().min(1).max(3).default(2),
  enabled: z.boolean().default(true),
});
export type PolicyRuleInput = z.infer<typeof policyRuleInputSchema>;

/** Full export/import envelope. */
export const settingsExportSchema = z.strictObject({
  format: z.literal("imageforge.settings.v1"),
  exportedAt: z.string(),
  version: z.number().int(),
  settings: appSettingsSchema,
  rules: z.array(policyRuleInputSchema).max(5000),
});

export function parseSettings(input: unknown): AppSettings {
  return appSettingsSchema.parse(input);
}
