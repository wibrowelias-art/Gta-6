#!/usr/bin/env node
/**
 * Fails if anything that looks like an API key — or the literal value of any
 * secret env var present at build time — appears in client-delivered output
 * (.next/static and the client reference manifests).
 *
 * CI builds with canary values (see .github/workflows/imageforge.yml) so a
 * leak of the real variable into the client bundle is caught deterministically.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".next");
const targets = [path.join(root, "static")];
if (!existsSync(targets[0])) {
  console.error(`No build output at ${targets[0]}. Run \`npm run build\` first.`);
  process.exit(2);
}

const SECRET_ENV = ["OPENAI_API_KEY", "GEMINI_API_KEY", "BLOB_READ_WRITE_TOKEN", "RESEND_API_KEY", "BETTER_AUTH_SECRET", "DEV_PIN", "DEV_BOOTSTRAP_PASSWORD", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CRON_SECRET", "DATABASE_URL"];
const patterns = [
  { name: "OpenAI key", re: /(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_]{20,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Vercel Blob token", re: /vercel_blob_rw_[A-Za-z0-9_]{10,}/ },
  { name: "Resend key", re: /\bre_[A-Za-z0-9]{20,}/ },
  { name: "Stripe secret", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { name: "Postgres URL with password", re: /postgres(?:ql)?:\/\/[^:\s"'`]+:[^@\s"'`]+@/ },
];
const literals = SECRET_ENV.map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 6);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|cjs|json|html|css|txt|map)$/.test(name)) yield p;
  }
}

let files = 0;
const hits = [];
for (const t of targets) {
  for (const f of walk(t)) {
    files++;
    const text = readFileSync(f, "utf8");
    for (const { name, re } of patterns) {
      const m = text.match(re);
      if (m) hits.push(`${path.relative(process.cwd(), f)}: ${name} pattern (${m[0].slice(0, 12)}…)`);
    }
    for (const [k, v] of literals) if (text.includes(v)) hits.push(`${path.relative(process.cwd(), f)}: value of ${k}`);
  }
}

if (hits.length) {
  console.error(`✖ Possible secrets in client bundle (${hits.length}):\n  ${hits.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ No secrets in client bundle (${files} files scanned, ${literals.length} env values checked).`);
