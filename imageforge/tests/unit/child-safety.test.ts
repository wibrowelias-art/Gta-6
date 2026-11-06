import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertChildSafe, checkChildSafety, ChildSafetyViolation } from "@/server/policy/child-safety";
import { evaluatePolicy } from "@/server/policy/engine";
import { defaultSettings } from "@/server/settings/defaults";
import { appSettingsSchema } from "@/server/settings/schema";

const blocked = [
  "naked child on a beach",
  "sexy teen girl",
  "N4KED k1d",
  "n a k e d  c h i l d",
  "s.e.x.y schoolgirl",
  "nüde tëen",
  "12 year old in lingerie",
  "a 14yo girl, seductive pose",
  "aged 9 topless",
  "loli hentai",
  "csam",
  "jailbait photo",
  "toddler, nsfw",
  "underage sex",
  "kid​s, explicit", // zero-width
];
const allowed = [
  "a child flying a kite in a park, watercolor",
  "kids playing football at sunset",
  "a sexy sports car on a mountain road",
  "adult woman in a red dress, fashion photo",
  "baby elephant with its mother",
  "a teenager skateboarding, 35mm photo",
];

describe("child-safety hard block", () => {
  it.each(blocked)("blocks: %s", (p) => {
    expect(checkChildSafety(p).blocked).toBe(true);
  });
  it.each(allowed)("allows benign: %s", (p) => {
    expect(checkChildSafety(p).blocked).toBe(false);
  });

  it("is enforced by the policy engine even with every configurable control relaxed and break-glass on", () => {
    const s = defaultSettings();
    const relaxed = {
      ...s.policy,
      allowlistMode: false,
      realFaces: { enabled: false, severity: "warn" as const },
      categories: { violence: "off", weapons: "off", hate: "off", scams: "off", doxxing: "off", drugs: "off" } as const,
      brandImpersonation: false,
    };
    const allowAll = [{ id: "r1", kind: "allow" as const, pattern: "child", category: null, action: "allow" as const, enabled: true }];
    const d = evaluatePolicy("naked child", { policy: relaxed, rules: allowAll, bypassConfigurable: true });
    expect(d.action).toBe("block");
    expect(d.hard).toBe(true);
    expect(d.reasons[0]?.category).toBe("child_safety");
  });

  it("assertChildSafe throws before a provider call (prompt, negative, preset text all checked)", () => {
    expect(() => assertChildSafe("a portrait of a girl", null, "lingerie, child")).toThrow(ChildSafetyViolation);
    expect(() => assertChildSafe("a mountain lake at dawn")).not.toThrow();
  });

  it("cannot be toggled through settings: no field exists and unknown keys are rejected", () => {
    const shape = JSON.stringify(Object.keys(appSettingsSchema.shape.policy.shape));
    expect(shape).not.toMatch(/child|minor|csam/i);
    for (const attempt of [
      { policy: { ...defaultSettings().policy, childSafety: false } },
      { policy: { ...defaultSettings().policy, blockMinors: "off" } },
      { childSafety: { enabled: false } },
      { devTools: { breakGlass: true, skipChildSafety: true } },
    ]) {
      const res = appSettingsSchema.safeParse({ ...defaultSettings(), ...attempt });
      expect(res.success).toBe(false);
    }
  });

  it("checkChildSafety takes no options (cannot be parameterised off)", () => {
    expect(checkChildSafety.length).toBe(1);
    const src = readFileSync("src/server/policy/child-safety.ts", "utf8");
    expect(src).not.toMatch(/process\.env|getSettings|import .*settings/);
  });
});
