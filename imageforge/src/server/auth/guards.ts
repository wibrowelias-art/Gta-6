import "server-only";
import { HttpError } from "@/server/http";
import { metaFromHeaders, type ReqMeta } from "@/server/request";
import { userFromHeaders, type CurrentUser } from "./session";
import { hasStepUp } from "./step-up";

export async function requireApiUser(req: Request): Promise<{ user: CurrentUser; meta: ReqMeta }> {
  const user = await userFromHeaders(req.headers);
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  return { user, meta: metaFromHeaders(req.headers) };
}

/**
 * Developer API gate. Non-developers get 404 (the console does not exist for them).
 * `stepUp: true` additionally requires a fresh TOTP / DEV_PIN verification (10 min).
 */
export async function requireDevApi(req: Request, opts: { stepUp?: boolean } = {}): Promise<{ user: CurrentUser; meta: ReqMeta; actor: { id: string; email: string } }> {
  const user = await userFromHeaders(req.headers);
  if (!user || user.role !== "developer") throw new HttpError(404, "NOT_FOUND", "Not found");
  if (opts.stepUp && !(await hasStepUp(user.id))) {
    throw new HttpError(401, "STEP_UP_REQUIRED", "Confirm it’s you with your developer PIN or authenticator code.");
  }
  return { user, meta: metaFromHeaders(req.headers), actor: { id: user.id, email: user.email } };
}
