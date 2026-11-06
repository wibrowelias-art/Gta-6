import { describe, expect, it } from "vitest";
import { evaluatePolicy, safeRewrite, type RuleLike } from "@/server/policy/engine";
import { normalizePrompt } from "@/server/policy/normalize";
import { defaultSettings } from "@/server/settings/defaults";

const policy = () => structuredClone(defaultSettings().policy);
const rule = (r: Partial<RuleLike>): RuleLike => ({ id: "rule-1", kind: "keyword", pattern: "x", category: null, action: "block", enabled: true, ...r });

describe("normalizePrompt", () => {
  it("strips invisible characters and tidies whitespace", () => {
    expect(normalizePrompt("  a​  cat\t\ton\u0007 a mat  ")).toBe("a cat on a mat");
  });
  it("applies NFKC", () => {
    expect(normalizePrompt("ｆｕｌｌ width")).toBe("full width");
  });
});

describe("evaluatePolicy", () => {
  it("allows a benign prompt", () => {
    expect(evaluatePolicy("a lighthouse at blue hour, soft fog", { policy: policy(), rules: [] }).action).toBe("allow");
  });

  it("blocks developer keyword rules, case- and leet-insensitive, with plurals", () => {
    const rules = [rule({ pattern: "dragon", category: "no_dragons" })];
    for (const p of ["A DRAGON", "two dr4gons", "d r a g o n"]) {
      const d = evaluatePolicy(p, { policy: policy(), rules });
      expect(d.action).toBe("block");
      expect(d.reasons[0]).toMatchObject({ category: "no_dragons", ruleId: "rule-1" });
    }
    expect(evaluatePolicy("dragonfly", { policy: policy(), rules }).action).toBe("allow");
  });

  it("ignores disabled rules", () => {
    expect(evaluatePolicy("dragon", { policy: policy(), rules: [rule({ pattern: "dragon", enabled: false })] }).action).toBe("allow");
  });

  it("supports regex rules and swallows invalid regex", () => {
    expect(evaluatePolicy("order #12345", { policy: policy(), rules: [rule({ kind: "regex", pattern: "#\\d{5}" })] }).action).toBe("block");
    expect(evaluatePolicy("order", { policy: policy(), rules: [rule({ kind: "regex", pattern: "(" })] }).action).toBe("allow");
  });

  it("supports category rules (comma list) and warn action", () => {
    const d = evaluatePolicy("a clown at a party", { policy: policy(), rules: [rule({ kind: "category", pattern: "clown, mime", category: "creepy", action: "warn" })] });
    expect(d.action).toBe("warn");
    expect(d.reasons[0]?.category).toBe("creepy");
  });

  it("respects category levels off / warn / block", () => {
    const p = policy();
    p.categories.weapons = "off";
    expect(evaluatePolicy("a knight holding a rifle", { policy: p, rules: [] }).action).toBe("allow");
    p.categories.weapons = "warn";
    expect(evaluatePolicy("a knight holding a rifle", { policy: p, rules: [] }).action).toBe("warn");
    p.categories.weapons = "block";
    expect(evaluatePolicy("a knight holding a rifle", { policy: p, rules: [] }).action).toBe("block");
  });

  it.each([
    ["hate", "a nazi rally poster"],
    ["scams", "a fake passport for john"],
    ["doxxing", "the home address of my neighbour"],
    ["drugs", "a meth lab in a trailer"],
    ["violence", "a decapitated soldier, gore"],
  ])("blocks %s by default", (cat, prompt) => {
    const p = policy();
    p.categories.violence = "block";
    const d = evaluatePolicy(prompt, { policy: p, rules: [] });
    expect(d.action).toBe("block");
    expect(d.reasons.map((r) => r.category)).toContain(cat);
  });

  it("blocks photoreal real-person prompts but allows stylised ones; severity configurable", () => {
    const p = policy();
    expect(evaluatePolicy("photorealistic portrait of Elon Musk", { policy: p, rules: [] }).action).toBe("block");
    expect(evaluatePolicy("taylor swift at the beach", { policy: p, rules: [] }).action).toBe("block");
    expect(evaluatePolicy("cartoon caricature of taylor swift", { policy: p, rules: [] }).action).toBe("allow");
    p.realFaces.severity = "warn";
    expect(evaluatePolicy("a candid photo of the president", { policy: p, rules: [] }).action).toBe("warn");
    p.realFaces.enabled = false;
    expect(evaluatePolicy("a candid photo of the president", { policy: p, rules: [] }).action).toBe("allow");
  });

  it("blocks brand impersonation when enabled", () => {
    const p = policy();
    expect(evaluatePolicy("official nike logo on a shoe box", { policy: p, rules: [] }).action).toBe("block");
    expect(evaluatePolicy("an apple pie on a table", { policy: p, rules: [] }).action).toBe("allow");
    p.brandImpersonation = false;
    expect(evaluatePolicy("official nike logo on a shoe box", { policy: p, rules: [] }).action).toBe("allow");
  });

  it("allowlist mode only permits allowed topics", () => {
    const p = policy();
    p.allowlistMode = true;
    p.allowedTopics = ["landscape", "architecture"];
    expect(evaluatePolicy("a misty landscape", { policy: p, rules: [] }).action).toBe("allow");
    expect(evaluatePolicy("a cute cat", { policy: p, rules: [] }).reasons[0]?.category).toBe("not_allowlisted");
    expect(evaluatePolicy("a cute cat", { policy: p, rules: [rule({ kind: "allow", pattern: "cat, dog" })] }).action).toBe("allow");
  });

  it("break-glass bypasses configurable policy only", () => {
    const rules = [rule({ pattern: "dragon" })];
    expect(evaluatePolicy("dragon", { policy: policy(), rules, bypassConfigurable: true }).action).toBe("allow");
    expect(evaluatePolicy("naked kid", { policy: policy(), rules, bypassConfigurable: true }).hard).toBe(true);
  });

  it("block wins over warn", () => {
    const d = evaluatePolicy("a rifle and a dragon", { policy: policy(), rules: [rule({ pattern: "dragon" })] });
    expect(d.action).toBe("block");
    expect(d.reasons.length).toBe(2);
  });
});

describe("safeRewrite", () => {
  it("strips warned terms and adds a safe suffix", () => {
    const d = evaluatePolicy("a knight holding a rifle in the rain", { policy: policy(), rules: [] });
    expect(d.action).toBe("warn");
    const out = safeRewrite("a knight holding a rifle in the rain", d);
    expect(out).not.toMatch(/rifle/i);
    expect(out).toMatch(/non-graphic/);
  });
});
