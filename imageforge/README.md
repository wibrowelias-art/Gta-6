# IMAGEFORGE

A high-end prompt → image studio with a private developer console.

* **User app** at `/` — landing, then Create, Gallery, History, Settings.
* **Developer console** at `/dev` — not linked anywhere. Only `role = developer` can open it; everyone else gets a plain *Not found* (HTTP 404), and `/api/dev/*` returns 404 too.

Stack: Next.js 15 (App Router) · TypeScript strict · Tailwind v4 + Radix primitives · Postgres (Neon) + Drizzle · Better Auth · Vercel Blob · Vitest + Playwright.

---

## Quick start (local)

```bash
cd imageforge
cp .env.example .env     # fill DATABASE_URL, BETTER_AUTH_SECRET, NEXT_PUBLIC_APP_URL, DEV_BOOTSTRAP_*, DEV_PIN
npm install
npm run db:migrate       # applies ./drizzle (also seeds the free/pro plans)
npm run db:seed          # creates the bootstrap developer if the user table is empty
npm run dev              # http://localhost:3000
```

No image API keys? The **stub provider** makes offline placeholder art, and images go to `./.data/blobs`. Sign in as the bootstrap developer, open `/dev`, and enter `DEV_PIN` when asked.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon: use the **pooled** connection string with `sslmode=require`. |
| `BETTER_AUTH_SECRET` | yes | 32+ random chars: `openssl rand -base64 32`. Also used to sign step-up cookies and encrypt TOTP secrets. |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL, e.g. `https://imageforge.example.com`. Used for auth origin checks and invite links. |
| `DEV_BOOTSTRAP_EMAIL` / `DEV_BOOTSTRAP_PASSWORD` | first boot | Becomes the first developer **only when the user table is empty**. |
| `DEV_PIN` | recommended | Step-up PIN for sensitive `/dev` actions (6+ digits). |
| `OPENAI_API_KEY` | optional | Enables OpenAI `gpt-image-1`. |
| `GEMINI_API_KEY` | optional | Enables Imagen (`imagen-*`) and Gemini native image models (`gemini-2.5-flash-image`). |
| `BLOB_READ_WRITE_TOKEN` | prod | Vercel Blob. Blank = local folder (dev only; Vercel's filesystem is read-only). |
| `BLOB_ACCESS` | optional | `private` (default) or `public`. Must match how the Blob store was created. Images are always served through the auth-checked `/api/images/:id` proxy. |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Turns on magic-link sign-in. Ship without it first. |
| `CRON_SECRET` | prod | Protects `/api/cron/retention`. Vercel Cron sends it automatically. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Billing is a stub in v1. Without keys, plan quotas still apply. |
| `TEST_DATABASE_URL` | tests | Separate DB for integration and e2e tests. Never production. |

Keys live only in server env. Every module that reads them imports `server-only`, so importing one from a client component fails the build, and `npm run scan:secrets` checks the client bundle.

## Deploy to Vercel (+ Neon + Blob)

1. **Neon:** create a project and copy the *pooled* connection string.
2. **Vercel:** import this repo and set **Root Directory = `imageforge`**. The framework is detected as Next.js.
3. **Blob:** Vercel → Storage → create a Blob store (private) and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. Add the env vars above in Vercel → Settings → Environment Variables.
5. **Migrate:** from your machine (or a CI step) run `DATABASE_URL=… npm run db:migrate` against the Neon DB.
6. Deploy, then open `/sign-in` once. That bootstraps the developer from `DEV_BOOTSTRAP_*` if the DB has no users. You can also run `npm run db:seed` locally against Neon.
7. Remove `DEV_BOOTSTRAP_PASSWORD` from Vercel afterwards. It is never used again once a user exists, but there's no reason to keep it.
8. In `/dev/security`, enroll an authenticator app (TOTP).
9. `vercel.json` schedules the retention job daily (`/api/cron/retention`).

## Auth & roles

* **Better Auth** with email + password. Magic link appears on the sign-in page only when `RESEND_API_KEY` is set.
* Roles: `user`, `moderator` (reserved, no extra powers in v1), `developer`. Role and ban state are read from the DB on every request, never from the cookie.
* **Invite-only:** when it's on, new accounts need an invite link from `/dev/access`. Any other way of creating a user (a direct POST to the auth API, or a magic link for an unknown email) is refused in a database hook.
* **Step-up:** every mutating `/dev` action requires a fresh verification that lasts 10 minutes: `DEV_PIN` or a TOTP code. If neither is configured, the account password is accepted so you can enroll TOTP. Attempts are rate-limited (5/min) and audited.
* Bans sign the user out everywhere and block new sessions.

## Live settings (no redeploy)

* All developer settings are one strict, Zod-validated JSON document stored in `app_settings`. **Every save creates a new version**, which you can see in `/dev/data`. `policy_rules` are versioned alongside it.
* Unknown fields are rejected on save and on import.
* Each server instance caches the active version for **15 s**. A save clears the local cache immediately, so every instance converges within 15 s.
* Every change writes an `audit_log` entry: who, what, when, IP, user agent, and before/after JSON. Search it at `/dev/audit`.

## Safety

* **Child-safety hard block** (`src/server/policy/child-safety.ts`) lives in code only:
  * It has no setting, column, flag, env var, API parameter or UI control.
  * It runs first in the policy engine, then again inside `callProvider()`, the only path to any image model. That covers create, remix, API, dry-run and break-glass.
  * It handles casing, accents, leetspeak, zero-width characters and spaced-out letters.
  * Every hit is refused, logged as a hard `refusal_event`, and audited.
* **Configurable policy:**
  * Categories (violence, weapons, hate, scams, doxxing, drug manufacturing) can be set to off, warn or block.
  * Photoreal real-people detection can be turned on or off, with warn or block severity.
  * Brand/logo impersonation detection can be turned on or off.
  * You can add your own keyword, regex and word-list rules.
  * Allowlist hard mode only permits prompts that mention an allowed topic.
  * You can set a custom refusal message and turn on an optional safe-rewrite pass for warned prompts.
* **Blocked prompt** ⇒ no provider call, no stored image, no quota used. The user sees your custom refusal.
* **Break glass** (Access & flags) lets the Policy dry-run tool generate past *configurable* rules only. Child safety still applies.

## Generation pipeline

```
auth → maintenance → rate limit (IP + user) → validate against live settings
→ concurrency → quota → normalize → style preset prefix/suffix → POLICY
→ [safe rewrite] → job row (queued) → provider with timeout (child safety re-checked)
→ one retry on next provider in fallback order → watermark → storage → images → quota → done
```

Providers sit behind one interface (`src/server/providers`):

* **OpenAI** `gpt-image-1`.
* **Gemini**: Imagen `:predict`, or Gemini native `:generateContent`.
* **Stub**: offline.

Disabled or unconfigured providers are skipped. Errors reach users only as safe messages.

## Tests

```bash
npm run check                      # typecheck + lint + unit/integration tests (integration needs TEST_DATABASE_URL)
npm run build && npm run scan:secrets
npx playwright test                # resets TEST_DATABASE_URL, builds nothing — run `npm run build` first
```

* `tests/unit` covers the policy engine, child safety, the settings schema, quotas, the watermark and the CSS sanitizer.
* `tests/integration` runs against real Postgres. It covers live settings, the pipeline (spy providers prove no call on block, plus fallback, quota, maintenance and rate limits), presets, retention and users admin.
* `tests/e2e` is the full acceptance flow with the stub provider.
* CI (`.github/workflows/imageforge.yml`) runs all of the above with Postgres 16. It builds with **canary secrets** and fails if any of them shows up in the client bundle.

## Not in v1

* Stripe checkout and webhooks. Plans and quotas work, but the billing UI is a stub.
* Image-to-image. The flag exists, but no provider path uses a reference image yet.
* The public API (`/api/v1/generate`, behind the `apiAccess` flag and allowed origins) uses session cookies. There are no API keys yet.
* `moderator` has no dedicated surface yet.
