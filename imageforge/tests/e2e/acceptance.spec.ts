import { expect, test, type Page } from "@playwright/test";

/**
 * Acceptance flow (serial, one shared DB):
 *  1. user signs up, generates with the stub provider, blocked prompt shows refusal
 *  2. normal user cannot open /dev
 *  3. developer logs in, step-up with DEV_PIN, turns on invite-only, adds a blocked
 *     keyword + custom refusal, sets daily quota to 5, disables a provider
 *  4. all of it applies to users within 30s without a redeploy
 *  5. child-safety cannot be disabled via API; actions are in the audit log
 */
test.describe.configure({ mode: "serial" });

const USER = { name: "Uma", email: `uma-${Date.now()}@example.com`, password: "password-123" };
const DEV = { email: "dev@e2e.local", password: "dev-password-e2e", pin: "135790" };
const LIVE = { timeout: 30_000, intervals: [500, 1000, 2000] };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/create");
}

async function stepUpIfAsked(page: Page) {
  const pin = page.locator("#stepup-code");
  const asked = await pin
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (asked) {
    await pin.fill(DEV.pin);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(pin).toBeHidden();
  }
}

async function save(page: Page) {
  await page.getByTestId("save-settings").click();
  await stepUpIfAsked(page);
  await expect(page.getByText("Saved · live within 15s").first()).toBeVisible();
}

test("user signs up and generates with the stub provider", async ({ page }) => {
  await page.goto("/sign-up");
  await page.fill("#name", USER.name);
  await page.fill("#email", USER.email);
  await page.fill("#password", USER.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/create");

  await expect(page.getByText("Your first image is one prompt away")).toBeVisible();
  // "/" focuses the prompt
  await page.locator("body").click({ position: { x: 5, y: 400 } });
  await page.keyboard.press("/");
  await expect(page.getByTestId("prompt")).toBeFocused();
  // Shift+Enter adds a newline, Enter generates
  await page.keyboard.type("a paper lantern festival");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("over a calm river");
  await expect(page.getByTestId("prompt")).toHaveValue("a paper lantern festival\nover a calm river");
  const before = Number(await page.getByTestId("remaining").textContent());
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("gallery-image")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("remaining")).toHaveText(String(before - 2));

  // lightbox + favorite
  await page.getByTestId("gallery-image").first().click();
  await expect(page.getByTestId("lightbox")).toBeVisible();
  await page.getByTestId("lightbox").getByRole("button", { name: "Favorite" }).click();
  await page.keyboard.press("Escape");

  // image is private: anonymous request gets 404
  const src = await page.getByTestId("gallery-image").first().getAttribute("src");
  const anon = await page.request.fetch(src!, { headers: { cookie: "" } });
  expect(anon.status()).toBe(404);
});

test("blocked prompt shows refusal, stores nothing, uses no quota", async ({ page }) => {
  await signIn(page, USER.email, USER.password);
  const images = await page.getByTestId("gallery-image").count();
  const remaining = await page.getByTestId("remaining").textContent();
  await page.getByTestId("prompt").fill("a nazi rally poster");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("refusal")).toContainText("can’t be generated");
  await page.reload();
  await expect(page.getByTestId("gallery-image")).toHaveCount(images);
  await expect(page.getByTestId("remaining")).toHaveText(remaining!);
});

test("normal user gets not-found on /dev and dev APIs", async ({ page }) => {
  await signIn(page, USER.email, USER.password);
  const res = await page.goto("/dev");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  expect((await page.request.get("/api/dev/settings")).status()).toBe(404);
  expect((await page.goto("/dev/policy"))?.status()).toBe(404);
});

test("developer changes settings live: invite-only, blocked keyword, quota 5, provider off", async ({ page, browser }) => {
  await signIn(page, DEV.email, DEV.password);
  expect((await page.goto("/dev"))?.status()).toBe(200);

  // Mutations without step-up are refused by the API
  const noStepUp = await page.request.patch("/api/dev/settings", { data: { patch: {} } });
  expect(noStepUp.status()).toBe(401);
  expect((await noStepUp.json()).error.code).toBe("STEP_UP_REQUIRED");

  // 1) invite-only
  await page.goto("/dev/access");
  await page.getByTestId("invite-only").click();
  await save(page);

  // 2) blocked keyword + custom refusal
  await page.goto("/dev/policy");
  await page.getByTestId("rule-pattern").fill("zeppelin");
  await page.getByTestId("add-rule").click();
  await stepUpIfAsked(page);
  await expect(page.getByTestId("rule-row")).toContainText("zeppelin");
  await page.fill("#refusal", "Airships are off-limits here.");
  await save(page);

  // 3) daily quota 5 for users
  await page.goto("/dev/generation");
  await page.fill("#quota-user-daily", "5");
  await save(page);

  // 4) disable a provider (the stub — the only one configured in e2e)
  await page.goto("/dev/providers");
  await page.getByRole("switch", { name: "Enable stub" }).click();
  await save(page);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Enable stub" })).toHaveAttribute("aria-checked", "false");

  // ---- effects, observed by real users within 30 s ----
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await expect
    .poll(async () => {
      const r = await ap.request.post("/api/account/sign-up", { data: { name: "New", email: `new-${Date.now()}@example.com`, password: "password-123" } });
      return r.status();
    }, LIVE)
    .toBe(403);
  await ap.goto("/sign-up");
  await expect(ap.getByText("Sign-ups are invite-only right now.")).toBeVisible();

  const userCtx = await browser.newContext();
  const up = await userCtx.newPage();
  await signIn(up, USER.email, USER.password);
  // quota 5 applies (user already used 2 today → 3 left)
  await expect.poll(async () => (await (await up.request.get("/api/me")).json()).usage.limits.daily, LIVE).toBe(5);
  await up.reload();
  await expect(up.getByTestId("remaining")).toHaveText("3");
  // provider disabled → no models available
  await expect(up.getByText("Image generation is temporarily unavailable.")).toBeVisible();
  // blocked keyword → custom refusal, even with provider off (policy runs first)
  await up.getByTestId("prompt").fill("a ZEPPELIN over the alps");
  await up.keyboard.press("Enter");
  await expect(up.getByTestId("refusal")).toHaveText("Airships are off-limits here.");

  // re-enable the stub; user can generate again, and quota is enforced at 5
  await page.getByRole("switch", { name: "Enable stub" }).click();
  await save(page);
  await up.reload();
  await up.getByTestId("prompt").fill("a quiet beach");
  await up.getByRole("radiogroup", { name: "Images" }).getByRole("radio", { name: "3", exact: true }).click();
  await up.getByTestId("prompt").press("Enter");
  await expect(up.getByTestId("remaining")).toHaveText("0", { timeout: 30_000 });
  const over = await up.request.post("/api/generate", { data: { prompt: "one more", count: 1 } });
  expect(over.status()).toBe(429);
  expect((await over.json()).error.code).toBe("QUOTA_EXCEEDED");
  await anon.close();
  await userCtx.close();
});

test("child safety cannot be disabled from UI or API, and actions are audited", async ({ page }) => {
  await signIn(page, DEV.email, DEV.password);
  await page.goto("/dev/policy");
  await stepUpIfAsked(page);
  // UI: badge only, no control
  const row = page.getByText("Child sexual content & sexualisation of minors").locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");
  await expect(row.getByText("Always blocked")).toBeVisible();
  await expect(row.getByRole("switch")).toHaveCount(0);

  // ensure step-up is active for API attempts
  const su = await page.request.post("/api/dev/step-up", { data: { method: "pin", code: DEV.pin } });
  expect(su.ok()).toBeTruthy();
  const current = await (await page.request.get("/api/dev/settings")).json();
  for (const body of [
    { patch: { childSafety: { enabled: false } } },
    { patch: { policy: { ...current.settings.policy, childSafety: false } } },
    { patch: { devTools: { breakGlass: true, skipChildSafety: true } } },
  ]) {
    const r = await page.request.patch("/api/dev/settings", { data: body });
    expect(r.status()).toBe(400);
  }
  const imp = await page.request.post("/api/dev/settings/import", {
    data: { format: "imageforge.settings.v1", exportedAt: new Date().toISOString(), version: 1, settings: { ...current.settings, childSafety: false }, rules: [] },
  });
  expect(imp.status()).toBe(400);

  // break glass on + dry-run generate: child-safety still blocks
  const s = await page.request.patch("/api/dev/settings", { data: { patch: { devTools: { breakGlass: true } } } });
  expect(s.ok()).toBeTruthy();
  const dr = await page.request.post("/api/dev/dry-run", { data: { prompt: "n4ked k1d", generate: true, breakGlass: true } });
  const drj = await dr.json();
  expect(drj.breakGlassDecision.hard).toBe(true);
  expect(drj.outcome.status).toBe("blocked");

  // dry-run UI shows the configurable block for the keyword
  await page.goto("/dev/dry-run");
  await page.getByTestId("dry-run-prompt").fill("a zeppelin");
  await page.getByTestId("dry-run-evaluate").click();
  await expect(page.getByTestId("dry-run-action").first()).toHaveText("block");

  // audit log has the developer's actions
  await page.goto("/dev/audit?q=settings.update");
  await expect(page.getByTestId("audit-row").first()).toContainText("settings.update");
  await page.goto("/dev/audit?action=policy.rules.update");
  await expect(page.getByTestId("audit-row").first()).toContainText(DEV.email);
  await page.goto("/dev/audit?action=dev.step_up.success");
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
});
