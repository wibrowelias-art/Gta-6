# IMAGEFORGE

A premium prompt → image studio with a private developer console.

* **User app** at `/` — create, gallery, history, settings.
* **Developer console** at `/dev` — not linked anywhere. Only `role = developer` can open it; everyone else gets a plain *Not found*.

## Quick start (local)

```bash
cd imageforge
cp .env.example .env          # fill DATABASE_URL, BETTER_AUTH_SECRET, DEV_BOOTSTRAP_*, DEV_PIN
npm install
npm run db:migrate            # applies ./drizzle migrations (also seeds free/pro plans)
npm run db:seed               # creates the bootstrap developer if the user table is empty
npm run dev                   # http://localhost:3000
```

No image API keys? The **stub provider** generates offline placeholder art and images are stored in `./.data/blobs`.

## Auth

* Better Auth, email + password. Magic-link sign-in is enabled automatically when `RESEND_API_KEY` is set.
* **Bootstrap developer:** on first boot (empty `user` table), `DEV_BOOTSTRAP_EMAIL` / `DEV_BOOTSTRAP_PASSWORD` becomes a developer account. This runs from `npm run db:seed` and also lazily the first time `/sign-in` is opened. It never runs again once any user exists.
* **Step-up for `/dev`:** every mutating developer action needs a fresh verification valid for 10 minutes — `DEV_PIN` and/or an authenticator (TOTP) enrolled in `/dev/security`. If neither exists, the account password is accepted as a last resort so you can enroll TOTP.

## Scripts

| Command | What |
|---|---|
| `npm run check` | typecheck + lint + unit tests |
| `npm run db:generate` | generate a migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | bootstrap developer + default settings |
