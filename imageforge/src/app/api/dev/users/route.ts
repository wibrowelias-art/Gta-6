import { requireDevApi } from "@/server/auth/guards";
import { handler, ok, readJson } from "@/server/http";
import { applyUserAction, listUsers, userActionSchema } from "@/server/users-admin";

export const GET = handler(async (req: Request) => {
  await requireDevApi(req);
  const url = new URL(req.url);
  return ok({ users: await listUsers({ text: url.searchParams.get("q") ?? undefined, offset: Number(url.searchParams.get("offset") ?? 0) || 0 }) });
});

export const POST = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  return ok(await applyUserAction(actor, meta, userActionSchema.parse(await readJson(req))));
});
