import { requireApiUser } from "@/server/auth/guards";
import { env } from "@/server/env";
import { fail, handler, ok, readJson } from "@/server/http";
import { runGeneration } from "@/server/pipeline/generate";
import { getSettings } from "@/server/settings/store";

export const maxDuration = 120;

/** CORS headers only for origins on the developer's allowlist (or same origin). */
async function corsFor(req: Request): Promise<Record<string, string> | null> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  const s = await getSettings();
  const allowed = new Set([new URL(env.APP_URL).origin, ...s.access.allowedOrigins.map((o) => new URL(o).origin)]);
  if (!allowed.has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" };
}

export const OPTIONS = handler(async (req: Request) => {
  const s = await getSettings();
  const cors = await corsFor(req);
  if (!s.access.flags.apiAccess || !cors) return new Response(null, { status: 404 });
  return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" } });
});

/** Public API (behind the apiAccess flag). Same pipeline and policy as the web app, source = "api". */
export const POST = handler(async (req: Request) => {
  const s = await getSettings();
  if (!s.access.flags.apiAccess) return fail(404, "NOT_FOUND", "Not found");
  const cors = await corsFor(req);
  if (!cors) return fail(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed");
  const { user, meta } = await requireApiUser(req);
  const outcome = await runGeneration(user, meta, await readJson(req), { source: "api" });
  return ok(outcome, { status: outcome.status === "blocked" ? 422 : 200, headers: cors });
});
