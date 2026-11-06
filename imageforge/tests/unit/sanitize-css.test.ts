import { describe, expect, it } from "vitest";
import { sanitizeCss } from "@/server/sanitize-css";

describe("sanitizeCss", () => {
  it("keeps ordinary rules", () => {
    expect(sanitizeCss(".hero{color:#fff;border-radius:12px}")).toBe(".hero{color:#fff;border-radius:12px}");
  });
  it("blocks tag breakout", () => {
    expect(sanitizeCss("</style><script>alert(1)</script>")).not.toMatch(/[<>]/);
  });
  it("removes remote loads and script vectors", () => {
    const out = sanitizeCss(`@import url(https://evil.test/x.css); a{background:url("javascript:alert(1)")} b{width:expression(alert(1))} c{behavior:url(x.htc)} d{bg:\\75rl(x)}`);
    expect(out).not.toMatch(/@import|url\(|expression\(|javascript:|behavior|\\/i);
  });
});
