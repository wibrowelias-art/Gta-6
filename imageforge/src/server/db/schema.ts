import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  date,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "moderator", "developer"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "blocked"]);
export const policyActionEnum = pgEnum("policy_action", ["allow", "warn", "block"]);
export const ruleKindEnum = pgEnum("rule_kind", ["keyword", "regex", "category", "allow"]);
export const jobSourceEnum = pgEnum("job_source", ["web", "remix", "api", "dry-run"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ---------------------------------------------------------------- plans
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  dailyQuota: integer("daily_quota").notNull(),
  monthlyQuota: integer("monthly_quota").notNull(),
  maxImagesPerRequest: integer("max_images_per_request").notNull().default(4),
  stripePriceId: text("stripe_price_id"),
  active: boolean("active").notNull().default(true),
});

// ---------------------------------------------------------------- Better Auth core tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  // IMAGEFORGE extensions
  role: roleEnum("role").notNull().default("user"),
  planId: text("plan_id")
    .notNull()
    .default("free")
    .references(() => plans.id),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  bannedAt: ts("banned_at"),
  theme: text("theme").notNull().default("dark"),
  /** AES-GCM encrypted TOTP secret for /dev step-up (developers only). */
  devTotpSecret: text("dev_totp_secret"),
  devTotpEnabled: boolean("dev_totp_enabled").notNull().default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- invites
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  tokenHash: text("token_hash").notNull().unique(),
  role: roleEnum("role").notNull().default("user"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- live settings (versioned)
export const appSettings = pgTable(
  "app_settings",
  {
    version: serial("version").primaryKey(),
    data: jsonb("data").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [uniqueIndex("app_settings_one_active").on(t.isActive).where(sql`${t.isActive} = true`)],
);

export const policyRules = pgTable(
  "policy_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    settingsVersion: integer("settings_version")
      .notNull()
      .references(() => appSettings.version, { onDelete: "cascade" }),
    kind: ruleKindEnum("kind").notNull(),
    pattern: text("pattern").notNull(),
    category: text("category"),
    action: policyActionEnum("action").notNull().default("block"),
    severity: integer("severity").notNull().default(2),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [index("policy_rules_version_idx").on(t.settingsVersion)],
);

// ---------------------------------------------------------------- presets
export const stylePresets = pgTable("style_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  promptPrefix: text("prompt_prefix").notNull().default(""),
  promptSuffix: text("prompt_suffix").notNull().default(""),
  negativeDefault: text("negative_default").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- generation
export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    prompt: text("prompt").notNull(),
    negativePrompt: text("negative_prompt"),
    normalizedPrompt: text("normalized_prompt").notNull(),
    revisedPrompt: text("revised_prompt"),
    presetId: uuid("preset_id").references(() => stylePresets.id, { onDelete: "set null" }),
    aspectRatio: text("aspect_ratio").notNull(),
    count: integer("count").notNull(),
    provider: text("provider"),
    model: text("model"),
    seed: text("seed"),
    policyVersion: integer("policy_version").notNull(),
    policyAction: policyActionEnum("policy_action").notNull(),
    policyReasons: jsonb("policy_reasons").notNull().default([]),
    attempt: integer("attempt").notNull().default(0),
    errorCode: text("error_code"),
    errorMessageSafe: text("error_message_safe"),
    costEstimateUsd: numeric("cost_estimate_usd", { precision: 10, scale: 4 }),
    latencyMs: integer("latency_ms"),
    source: jobSourceEnum("source").notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("jobs_user_created_idx").on(t.userId, t.createdAt.desc()), index("jobs_status_idx").on(t.status)],
);

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    watermarked: boolean("watermarked").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(false),
    shareSlug: text("share_slug").unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at"),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("images_user_created_idx").on(t.userId, t.createdAt.desc()), index("images_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------- quotas & limits
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodType: text("period_type").notNull(), // 'day' | 'month'
    periodStart: date("period_start", { mode: "string" }).notNull(),
    used: integer("used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.periodType, t.periodStart] })],
);

export const quotaOverrides = pgTable("quota_overrides", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  dailyQuota: integer("daily_quota"),
  monthlyQuota: integer("monthly_quota"),
  resetAt: ts("reset_at"),
});

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// ---------------------------------------------------------------- observability
export const refusalEvents = pgTable(
  "refusal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    ip: text("ip"),
    category: text("category").notNull(),
    ruleId: text("rule_id"),
    hard: boolean("hard").notNull().default(false),
    promptHash: text("prompt_hash").notNull(),
    /** Only populated for hard (child-safety) refusals: short redacted excerpt for review. */
    excerpt: text("excerpt"),
    source: jobSourceEnum("source").notNull().default("web"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("refusal_created_idx").on(t.createdAt), index("refusal_category_idx").on(t.category)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt.desc()),
    index("audit_actor_idx").on(t.actorId),
    index("audit_action_idx").on(t.action),
  ],
);

export type UserRow = typeof user.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type JobRow = typeof generationJobs.$inferSelect;
export type ImageRow = typeof images.$inferSelect;
export type PolicyRuleRow = typeof policyRules.$inferSelect;
export type PresetRow = typeof stylePresets.$inferSelect;
