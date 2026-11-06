import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { appSettings, auditLog } from "@/server/db/schema";
import { patchSettings, replaceRules, replaceSettings } from "@/server/settings/admin";
import { defaultSettings } from "@/server/settings/defaults";
import { getConfig, getSettings } from "@/server/settings/store";
import { hasDb, makeUser, resetDb } from "../support/db";

const meta = { ip: "127.0.0.1", userAgent: "vitest" };

describe.skipIf(!hasDb)("live settings", () => {
  beforeEach(resetDb);

  it("creates defaults on first read and applies saves immediately (new version + audit)", async () => {
    const dev = await makeUser("developer");
    const v1 = await getConfig();
    expect(v1.settings.access.inviteOnly).toBe(false);

    const s = await getSettings();
    await patchSettings(dev, meta, { access: { ...s.access, inviteOnly: true }, quotas: { byRole: { ...s.quotas.byRole, user: { daily: 5, monthly: 100 } } } });
    const after = await getConfig();
    expect(after.version).toBeGreaterThan(v1.version);
    expect(after.settings.access.inviteOnly).toBe(true);
    expect(after.settings.quotas.byRole.user.daily).toBe(5);

    const active = await db.select().from(appSettings).where(eq(appSettings.isActive, true));
    expect(active).toHaveLength(1);

    const [log] = await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(1);
    expect(log?.action).toBe("settings.update");
    expect(log?.actorId).toBe(dev.id);
    expect(log?.ip).toBe("127.0.0.1");
    expect((log?.before as { settings: { access: { inviteOnly: boolean } } }).settings.access.inviteOnly).toBe(false);
    expect((log?.after as { settings: { access: { inviteOnly: boolean } } }).settings.access.inviteOnly).toBe(true);
  });

  it("rules carry forward across settings saves", async () => {
    const dev = await makeUser("developer");
    await replaceRules(dev, meta, [{ kind: "keyword", pattern: "dragon", action: "block" }]);
    const s = await getSettings();
    await patchSettings(dev, meta, { branding: { ...s.branding, appName: "Forge" } });
    const cfg = await getConfig();
    expect(cfg.settings.branding.appName).toBe("Forge");
    expect(cfg.rules.map((r) => r.pattern)).toEqual(["dragon"]);
  });

  it("rejects attempts to disable child safety via the settings API surface", async () => {
    const dev = await makeUser("developer");
    const s = await getSettings();
    await expect(patchSettings(dev, meta, { childSafety: { enabled: false } })).rejects.toMatchObject({ code: "INVALID_SETTINGS" });
    await expect(patchSettings(dev, meta, { policy: { ...s.policy, childSafety: false } })).rejects.toMatchObject({ code: "INVALID_SETTINGS" });
    await expect(replaceSettings(dev, meta, { ...defaultSettings(), minors: "allow" })).rejects.toMatchObject({ code: "INVALID_SETTINGS" });
    await expect(replaceRules(dev, meta, [{ kind: "allow", pattern: "x", hard: false }])).rejects.toMatchObject({ code: "INVALID_SETTINGS" });
  });

  it("rejects invalid regex rules", async () => {
    const dev = await makeUser("developer");
    await expect(replaceRules(dev, meta, [{ kind: "regex", pattern: "(" }])).rejects.toMatchObject({ code: "INVALID_SETTINGS" });
  });
});
