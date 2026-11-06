import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { appSettings, policyRules, type PolicyRuleRow } from "@/server/db/schema";
import { env } from "@/server/env";
import { defaultRules, defaultSettings } from "./defaults";
import { appSettingsSchema, policyRuleInputSchema, type AppSettings, type PolicyRuleInput } from "./schema";

export type ActiveConfig = {
  version: number;
  settings: AppSettings;
  rules: PolicyRuleRow[];
  loadedAt: number;
};

/** Per-instance cache TTL. Saves bust the local cache immediately; other instances converge within this window. */
export const SETTINGS_TTL_MS = 15_000;

const g = globalThis as unknown as { __ifSettings?: ActiveConfig; __ifSettingsLoading?: Promise<ActiveConfig> };

export function invalidateSettingsCache() {
  g.__ifSettings = undefined;
  g.__ifSettingsLoading = undefined;
}

export async function getConfig(): Promise<ActiveConfig> {
  const cached = g.__ifSettings;
  if (cached && Date.now() - cached.loadedAt < SETTINGS_TTL_MS) return cached;
  g.__ifSettingsLoading ??= loadActive().finally(() => {
    g.__ifSettingsLoading = undefined;
  });
  const fresh = await g.__ifSettingsLoading;
  g.__ifSettings = fresh;
  return fresh;
}

export async function getSettings(): Promise<AppSettings> {
  return (await getConfig()).settings;
}

async function loadActive(): Promise<ActiveConfig> {
  let row = await db.query.appSettings.findFirst({ where: eq(appSettings.isActive, true) });
  if (!row) {
    await ensureDefaultSettings();
    row = await db.query.appSettings.findFirst({ where: eq(appSettings.isActive, true) });
    if (!row) throw new Error("Failed to initialise settings");
  }
  // Stored data is re-validated on load; a bad row falls back to defaults rather than crash.
  const parsed = appSettingsSchema.safeParse(row.data);
  const settings = parsed.success ? parsed.data : defaultSettings({ hasRealProvider: hasRealProvider() });
  const rules = await db.select().from(policyRules).where(eq(policyRules.settingsVersion, row.version));
  return { version: row.version, settings, rules, loadedAt: Date.now() };
}

export function hasRealProvider() {
  return Boolean(env.OPENAI_API_KEY || env.GEMINI_API_KEY);
}

export async function ensureDefaultSettings() {
  const existing = await db.select({ v: appSettings.version }).from(appSettings).limit(1);
  if (existing.length > 0) {
    const active = await db.select({ v: appSettings.version }).from(appSettings).where(eq(appSettings.isActive, true));
    if (active.length === 0) {
      const latest = await db.select().from(appSettings).orderBy(desc(appSettings.version)).limit(1);
      if (latest[0]) await db.update(appSettings).set({ isActive: true }).where(eq(appSettings.version, latest[0].version));
    }
    return;
  }
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(appSettings)
      .values({ data: defaultSettings({ hasRealProvider: hasRealProvider() }), isActive: true, note: "defaults" })
      .returning();
    if (row && defaultRules.length) {
      await tx.insert(policyRules).values(defaultRules.map((r) => ({ ...toRuleRow(r), settingsVersion: row.version })));
    }
  });
}

function toRuleRow(r: PolicyRuleInput) {
  return {
    kind: r.kind,
    pattern: r.pattern,
    category: r.category ?? null,
    action: r.action,
    severity: r.severity,
    enabled: r.enabled,
  };
}

export function ruleRowToInput(r: PolicyRuleRow): PolicyRuleInput {
  return {
    id: r.id,
    kind: r.kind,
    pattern: r.pattern,
    category: r.category,
    action: r.action,
    severity: r.severity,
    enabled: r.enabled,
  };
}

export class SettingsValidationError extends Error {
  constructor(public issues: { path: string; message: string }[]) {
    super("Invalid settings");
  }
}

/**
 * Persist a new settings version (append-only). Validates the full shape,
 * rejects unknown keys, copies rules forward unless replaced, flips the active
 * row atomically and busts the local cache.
 */
export async function saveConfig(input: {
  settings: unknown;
  rules?: unknown[];
  actorId: string | null;
  note?: string;
}): Promise<ActiveConfig> {
  const parsed = appSettingsSchema.safeParse(input.settings);
  if (!parsed.success) {
    throw new SettingsValidationError(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  let newRules: PolicyRuleInput[] | undefined;
  if (input.rules) {
    const out: PolicyRuleInput[] = [];
    const issues: { path: string; message: string }[] = [];
    input.rules.forEach((r, idx) => {
      const p = policyRuleInputSchema.safeParse(r);
      if (!p.success) p.error.issues.forEach((i) => issues.push({ path: `rules.${idx}.${i.path.join(".")}`, message: i.message }));
      else {
        if (p.data.kind === "regex") {
          try {
            new RegExp(p.data.pattern, "iu");
          } catch {
            issues.push({ path: `rules.${idx}.pattern`, message: "Invalid regular expression" });
          }
        }
        out.push(p.data);
      }
    });
    if (issues.length) throw new SettingsValidationError(issues);
    newRules = out;
  }

  const current = await getConfigUncached();
  const rulesToWrite = newRules ?? current.rules.map(ruleRowToInput);

  await db.transaction(async (tx) => {
    await tx.update(appSettings).set({ isActive: false }).where(and(eq(appSettings.isActive, true)));
    const [row] = await tx
      .insert(appSettings)
      .values({ data: parsed.data, isActive: true, createdBy: input.actorId, note: input.note ?? null })
      .returning();
    if (!row) throw new Error("insert failed");
    if (rulesToWrite.length) {
      await tx.insert(policyRules).values(rulesToWrite.map((r) => ({ ...toRuleRow(r), settingsVersion: row.version })));
    }
  });
  invalidateSettingsCache();
  return getConfig();
}

export async function getConfigUncached(): Promise<ActiveConfig> {
  invalidateSettingsCache();
  return getConfig();
}

export async function listSettingsVersions(limit = 20) {
  return db
    .select({ version: appSettings.version, isActive: appSettings.isActive, createdAt: appSettings.createdAt, note: appSettings.note, createdBy: appSettings.createdBy })
    .from(appSettings)
    .orderBy(desc(appSettings.version))
    .limit(limit);
}
