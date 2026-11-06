# IMAGEFORGE — Phase 0: File Plan & Data Model

Status: **awaiting developer OK** before any code is written.

## 0. Location in this repo

This repo already holds an unrelated `gta-vi-menu.zip`. To keep it clean, IMAGEFORGE lives in
`imageforge/` (Vercel "Root Directory" = `imageforge`). Say the word if you want it at the repo root instead.

## 1. Stack decisions (locked unless you object)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript `strict` | as spec'd |
| UI | Tailwind v4 + shadcn/ui (Radix) + lucide icons + sonner toasts | premium look, accessible primitives |
| DB | Postgres (Neon) via **Drizzle ORM** + drizzle-kit migrations | typed SQL, light runtime, serverless friendly |
| Auth | **Better Auth** (email + password, optional magic link, TOTP plugin) | self-hosted in our DB, built-in TOTP for `/dev` step-up, no vendor lock |
| Storage | `StorageDriver` interface → Vercel Blob (prod) / local `./.data/blobs` (dev, tests) | offline tests |
| Images | `ImageProvider` interface → `openai`, `gemini`, `stub` | pluggable, fallback order |
| Validation | Zod everywhere (API input, settings JSON, import/export) | |
| Rate limit | Postgres fixed-window counters (`rate_limit_buckets`) | zero extra infra; Upstash adapter optional later |
| Image ops | `sharp` (watermark, thumbnails, metadata strip) | |
| Jobs | Generation runs inside the route (`maxDuration` 60s) with a `generation_jobs` row as state machine; retention via Vercel Cron → `/api/cron/retention` | no queue infra in v1; queue adapter seam left in |
| Tests | Vitest (unit), Playwright (e2e, stub provider) | |
| Lint | ESLint (next + typescript-eslint strict) + Prettier | |

**Auth method for users:** email + password by default; magic link becomes available when `EMAIL_SERVER`/`RESEND_API_KEY` is set (feature-flagged). Developer bootstrap uses env password.

## 2. File plan

```
imageforge/
├─ .env.example                       # every key, blank
├─ drizzle.config.ts
├─ next.config.ts                     # security headers, CSP, images remotePatterns
├─ vercel.json                        # cron: retention daily
├─ playwright.config.ts / vitest.config.ts
├─ scripts/
│  ├─ seed.ts                         # bootstrap developer + default settings v1
│  └─ check-bundle-secrets.sh         # rg .next/static for key patterns → fail CI
├─ drizzle/                           # generated migrations
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/                 # static, Lighthouse-90 target
│  │  │  ├─ page.tsx                  # landing
│  │  │  ├─ about/page.tsx            # ownership/ToS/privacy line
│  │  │  └─ terms/page.tsx
│  │  ├─ (auth)/sign-in, sign-up, invite/[token]
│  │  ├─ (app)/                       # user shell, requires session
│  │  │  ├─ layout.tsx                # nav, usage meter, maintenance banner
│  │  │  ├─ create/page.tsx           # prompt box, presets, ratio, count
│  │  │  ├─ gallery/page.tsx          # grid + lightbox, fav/delete/remix/download
│  │  │  ├─ history/page.tsx
│  │  │  └─ settings/page.tsx         # display name, theme
│  │  ├─ dev/                         # developer console (not linked anywhere)
│  │  │  ├─ layout.tsx                # role === developer gate, 404 otherwise
│  │  │  ├─ step-up/page.tsx          # TOTP or DEV_PIN
│  │  │  ├─ page.tsx                  # overview: queue depth, error rate, refusals
│  │  │  ├─ policy/  generation/  presets/  access/  providers/
│  │  │  ├─ branding/  billing/  users/  audit/  data/ (export/import)
│  │  │  └─ dry-run/page.tsx          # policy tester (+ break-glass)
│  │  └─ api/
│  │     ├─ auth/[...all]/route.ts    # Better Auth handler
│  │     ├─ generate/route.ts         # POST: pipeline
│  │     ├─ generations/[id]/route.ts # GET/DELETE/PATCH(favorite)
│  │     ├─ images/[id]/route.ts      # auth-checked image proxy (private by default)
│  │     ├─ cron/retention/route.ts   # CRON_SECRET protected
│  │     └─ dev/*                     # settings, users, audit, export/import, dry-run
│  ├─ server/
│  │  ├─ db/{client.ts, schema.ts}
│  │  ├─ auth/{auth.ts, session.ts, guards.ts, step-up.ts}
│  │  ├─ settings/{schema.ts, defaults.ts, store.ts, cache.ts}   # versioned, 15s TTL
│  │  ├─ policy/
│  │  │  ├─ child-safety.ts           # HARD-CODED, not in settings schema, cannot be toggled
│  │  │  ├─ engine.ts                 # evaluate(prompt, rules) → allow|warn|block + reasons
│  │  │  ├─ categories.ts             # violence, weapons, hate, scams, doxxing, drugs, real-faces, brands
│  │  │  ├─ normalize.ts              # NFKC, leetspeak, zero-width strip, whitespace
│  │  │  └─ rewrite.ts                # optional safe-rewrite pass
│  │  ├─ providers/{types.ts, openai.ts, gemini.ts, stub.ts, registry.ts}
│  │  ├─ storage/{types.ts, vercel-blob.ts, local.ts}
│  │  ├─ pipeline/generate.ts         # the 10-step pipeline (section 5)
│  │  ├─ quota.ts  rate-limit.ts  audit.ts  watermark.ts  retention.ts
│  │  └─ sanitize-css.ts              # allowlist-based CSS sanitizer for branding
│  ├─ components/ui/*  (shadcn)  + create/, gallery/, dev/
│  └─ lib/{env.ts (zod, server-only), utils.ts, keyboard.ts}
└─ tests/
   ├─ unit/{policy-engine, child-safety, normalize, quota, settings, sanitize-css}.test.ts
   └─ e2e/{user-generate, dev-block-topic, child-safety-immutable}.spec.ts
```

`server/**` and `lib/env.ts` import `server-only`, so any accidental client import breaks the build.

## 3. Data model (Drizzle / Postgres)

Better Auth owns `user`, `session`, `account`, `verification`, `two_factor`; we extend `user`.

```ts
// enums
role          = 'user' | 'moderator' | 'developer'
job_status    = 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked'
policy_action = 'allow' | 'warn' | 'block'

user {
  id, email (unique), name, image, emailVerified,
  role: role = 'user',
  planId -> plans.id (default 'free'),
  banned: bool, banReason, bannedAt,
  theme: 'dark'|'light' = 'dark',
  createdAt, updatedAt
}

plans {
  id ('free'|'pro'|...), name, dailyQuota int, monthlyQuota int,
  maxImagesPerRequest int, stripePriceId nullable, active bool
}

invites { id, email nullable, token (unique, hashed), createdBy -> user, role, expiresAt, usedAt, usedBy }

// Live settings: append-only versions; exactly one active row.
app_settings {
  version serial PK, data jsonb (validated by AppSettingsSchema),
  isActive bool, createdBy -> user, createdAt, note
}
policy_rules {               // versioned alongside settings
  id, settingsVersion -> app_settings.version,
  kind: 'keyword'|'regex'|'category'|'allow',
  pattern text, category text nullable,
  action policy_action, severity int (1-3), enabled bool
}

style_presets {
  id, slug unique, name, thumbnailUrl, promptPrefix, promptSuffix,   // prefix/suffix never sent to client
  negativeDefault, sortOrder, enabled bool, createdAt, updatedAt
}

generation_jobs {
  id uuid, userId -> user, status job_status,
  prompt, negativePrompt, normalizedPrompt, revisedPrompt,
  presetId nullable, aspectRatio, count int,
  provider, model, seed nullable,
  policyVersion int, policyAction policy_action, policyReasons jsonb,
  attempt int, errorCode, errorMessageSafe,
  costEstimateUsd numeric, latencyMs int,
  source: 'web'|'remix'|'api'|'dry-run',
  createdAt, startedAt, finishedAt
  index (userId, createdAt desc), index (status)
}

images {
  id uuid, jobId -> generation_jobs (cascade), userId -> user,
  storageKey, width, height, mime, bytes,
  watermarked bool, favorite bool, isPublic bool = false, shareSlug nullable unique,
  createdAt, expiresAt (from retentionDays), deletedAt
}

usage_counters { userId, periodType 'day'|'month', periodStart date, used int  PK(userId, periodType, periodStart) }
quota_overrides { userId PK, dailyQuota nullable, monthlyQuota nullable, resetAt }

rate_limit_buckets { key text ('ip:1.2.3.4'|'user:..'), windowStart timestamptz, count int  PK(key, windowStart) }

refusal_events { id, userId nullable, ip, category, ruleId nullable, hard bool, promptHash, createdAt }
   // stores a hash, not raw text, except for child-safety hits which keep a redacted excerpt for review

audit_log {
  id bigserial, actorId -> user, action text ('settings.update','user.ban',...),
  targetType, targetId, ip, userAgent,
  before jsonb, after jsonb, createdAt
  index (createdAt desc), index (actorId), index (action)
}
```

### AppSettings JSON (Zod-validated, one blob, versioned)

```ts
{
  policy: {
    allowlistMode: boolean, allowedTopics: string[],
    realFaces:   { enabled: boolean, severity: 'warn'|'block' },
    categories:  Record<'violence'|'weapons'|'hate'|'scams'|'doxxing'|'drugs', 'off'|'warn'|'block'>,
    brandImpersonation: boolean,
    refusalMessage: string,
    safeRewrite: boolean
    // NOTE: no child-safety field exists. Unknown keys are rejected by .strict().
  },
  generation: {
    defaultModel, allowedModels: string[], maxImagesPerRequest, maxPromptLength,
    maxConcurrentJobsPerUser, aspectRatios: string[],
    watermark: { enabled, text, opacity, position: 'br'|'bl'|'tr'|'tl'|'center' },
    retentionDays: number
  },
  quotas: { byRole: Record<role, {daily, monthly}> },   // plan quotas live in `plans`
  access: {
    inviteOnly, maintenance: { enabled, message },
    flags: { publicShare, remix, apiAccess, negativePrompt, img2img },
    rateLimits: { perIpPerMin, perUserPerMin }, allowedOrigins: string[]
  },
  branding: { appName, logoUrl, accentColor, customCss, footerLinks: {label,url}[], supportEmail },
  providers: { order: ('openai'|'gemini'|'stub')[], enabled: Record<id, boolean>, costPerImageUsd: Record<id, number> },
  devTools: { breakGlass: boolean }   // bypasses configurable policy for dry-run only; child-safety still enforced
}
```

Live-apply: `getSettings()` caches the active row per server instance for **15 s**; saving inserts a new
version and flips `isActive` in one transaction, then busts the local cache. Worst case propagation across
serverless instances ≈ 15 s (< 30 s acceptance).

## 4. Key invariants (designed in, tested)

1. **Child-safety hard block** — code-only module, runs first in `engine.evaluate()` and again directly in
   the pipeline right before `provider.generate()` (defence in depth). Not represented in settings schema,
   API, UI, break-glass or dry-run bypass. Every hit → `refusal_events(hard=true)` + audit entry.
2. **Block ⇒ no provider call, no image stored, no quota spent.** Job row saved as `blocked`.
3. **Keys server-only** — `env.ts` is `server-only`; provider status UI shows `set ••••last4` / `missing`;
   `scripts/check-bundle-secrets.sh` greps `.next/static` for `sk-`, `AIza`, env var values; runs in CI.
4. **`/dev` is invisible** — non-developers get a real 404 (not 403); sensitive mutations require a step-up
   token (TOTP or `DEV_PIN`) valid 10 min.
5. **Every admin mutation** goes through `withAudit(actor, action, before, after)`.
6. Images are **private by default**, served via auth-checked `/api/images/[id]`, unless `publicShare` flag is on and the user shares.

## 5. Pipeline (POST /api/generate)

`auth & not banned → maintenance/invite checks → rate limit (IP+user) → concurrency check →
quota check → zod-validate vs settings (count, ratio, length, model, flags) → normalize →
child-safety (hard) → policy engine → [safe rewrite] → preset prefix/suffix → insert job(queued) →
provider.generate (timeout 45s) → on failure retry once on next enabled provider → watermark (sharp) →
storage.put → images rows → increment usage → job succeeded → return URLs`.
Errors map to user-safe codes (`QUOTA_EXCEEDED`, `POLICY_BLOCKED`, `PROVIDER_UNAVAILABLE`, …).

## 6. Phase plan

| Phase | Deliverable |
|---|---|
| **1** | Scaffold, env, Drizzle schema + migrations, Better Auth, roles, bootstrap developer seed, empty user shell, `/dev` gate + step-up |
| **2** | Settings store + cache, `/dev` panels: policy, generation/quotas, providers, access, branding, billing stub |
| **3** | Providers (openai, gemini, stub), storage drivers, pipeline, create UI, gallery, lightbox, history, usage meter |
| **4** | Presets CRUD, remix, watermark, retention cron, audit log viewer, users admin, export/import, observability, unit tests |
| **5** | Polish, keyboard shortcuts, Lighthouse pass, Playwright smoke, bundle secret scan, README, Vercel deploy notes |

## 7. Questions (defaults assumed if you don't answer)

1. Folder: `imageforge/` subfolder (default) or repo root?
2. Auth: Better Auth with email+password (default) — OK, or prefer Clerk?
3. Gemini model: default to the current Gemini image model available on your key; OpenAI default `gpt-image-1`. OK?
4. Magic link email provider: Resend (default, optional) or none in v1?
