import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { stubProvider } from "@/server/providers/stub";
import { dimensionsFor, openAiSize } from "@/server/providers/sizes";
import { effectiveLimits, periodStarts } from "@/server/quota";
import { defaultSettings } from "@/server/settings/defaults";
import { applyWatermark } from "@/server/watermark";

describe("effectiveLimits", () => {
  const s = defaultSettings();
  it("users get the lower of role and plan", () => {
    s.quotas.byRole.user = { daily: 5, monthly: 1000 };
    expect(effectiveLimits("user", s, { dailyQuota: 25, monthlyQuota: 300 }, null)).toEqual({ daily: 5, monthly: 300 });
  });
  it("developers ignore plan caps", () => {
    expect(effectiveLimits("developer", s, { dailyQuota: 25, monthlyQuota: 300 }, null).daily).toBe(1000);
  });
  it("overrides win", () => {
    expect(effectiveLimits("user", s, { dailyQuota: 25, monthlyQuota: 300 }, { dailyQuota: 99, monthlyQuota: null })).toEqual({ daily: 99, monthly: 300 });
  });
  it("periods are UTC day and month", () => {
    expect(periodStarts(new Date("2026-03-09T23:59:00Z"))).toEqual({ day: "2026-03-09", month: "2026-03-01" });
  });
});

describe("sizes", () => {
  it("maps ratios", () => {
    expect(openAiSize("16:9")).toBe("1536x1024");
    expect(openAiSize("9:16")).toBe("1024x1536");
    expect(dimensionsFor("16:9", 768)).toEqual({ width: 768, height: 432 });
  });
});

describe("watermark", () => {
  it("changes pixels in the chosen corner and keeps size", async () => {
    const { images } = await stubProvider.generate({ prompt: "plain", aspectRatio: "1:1", count: 1, model: "stub-v1", signal: AbortSignal.timeout(5000) });
    const src = images[0]!.data;
    const out = await applyWatermark(src, { enabled: true, text: "IMAGEFORGE", opacity: 1, position: "br" });
    const [a, b] = await Promise.all([sharp(src).metadata(), sharp(out).metadata()]);
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    const region = { left: Math.round(a.width! * 0.55), top: Math.round(a.height! * 0.9), width: Math.round(a.width! * 0.4), height: Math.round(a.height! * 0.08) };
    const [ra, rb] = await Promise.all([sharp(src).extract(region).raw().toBuffer(), sharp(out).extract(region).raw().toBuffer()]);
    expect(Buffer.compare(ra, rb)).not.toBe(0);
    const topLeft = { left: 0, top: 0, width: 40, height: 40 };
    const [ta, tb] = await Promise.all([sharp(src).extract(topLeft).raw().toBuffer(), sharp(out).extract(topLeft).raw().toBuffer()]);
    expect(Buffer.compare(ta, tb)).toBe(0);
  });
});
