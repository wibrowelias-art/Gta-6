import type { AppSettings, PolicyRuleInput } from "./schema";

export function defaultSettings(opts: { hasRealProvider: boolean } = { hasRealProvider: false }): AppSettings {
  return {
    policy: {
      allowlistMode: false,
      allowedTopics: [],
      realFaces: { enabled: true, severity: "block" },
      categories: {
        violence: "warn",
        weapons: "warn",
        hate: "block",
        scams: "block",
        doxxing: "block",
        drugs: "block",
      },
      brandImpersonation: true,
      refusalMessage: "This prompt can’t be generated. Try describing something else.",
      safeRewrite: false,
    },
    generation: {
      defaultModel: "openai:gpt-image-1",
      allowedModels: ["openai:gpt-image-1", "gemini:imagen-4.0-generate-001", "gemini:gemini-2.5-flash-image", "stub:stub-v1"],
      maxImagesPerRequest: 4,
      maxPromptLength: 1000,
      maxConcurrentJobsPerUser: 2,
      aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
      watermark: { enabled: false, text: "IMAGEFORGE", opacity: 0.35, position: "br" },
      retentionDays: 90,
      providerTimeoutMs: 60_000,
    },
    quotas: {
      byRole: {
        user: { daily: 25, monthly: 300 },
        moderator: { daily: 100, monthly: 2000 },
        developer: { daily: 1000, monthly: 20000 },
      },
    },
    access: {
      inviteOnly: false,
      maintenance: { enabled: false, message: "IMAGEFORGE is down for a short upgrade. Back soon." },
      flags: { publicShare: false, remix: true, apiAccess: false, negativePrompt: true, img2img: false },
      rateLimits: { perIpPerMin: 60, perUserPerMin: 20 },
      allowedOrigins: [],
    },
    branding: {
      appName: "IMAGEFORGE",
      logoUrl: "",
      accentColor: "#8b5cf6",
      customCss: "",
      footerLinks: [],
      supportEmail: "",
    },
    providers: {
      order: ["openai", "gemini", "stub"],
      // Stub is only on by default when no real provider key is configured,
      // so real users never get placeholder art by accident.
      enabled: { openai: true, gemini: true, stub: !opts.hasRealProvider },
      costPerImageUsd: { openai: 0.04, gemini: 0.03, stub: 0 },
    },
    devTools: { breakGlass: false },
  };
}

export const defaultRules: PolicyRuleInput[] = [];
