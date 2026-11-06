import { requireApiUser } from "@/server/auth/guards";
import { handler, ok, readJson } from "@/server/http";
import { runGeneration } from "@/server/pipeline/generate";

export const maxDuration = 120;

export const POST = handler(async (req: Request) => {
  const { user, meta } = await requireApiUser(req);
  const outcome = await runGeneration(user, meta, await readJson(req), { source: "web" });
  // Blocked prompts return 422 with the custom refusal; nothing was generated or stored.
  return ok(outcome, { status: outcome.status === "blocked" ? 422 : 200 });
});
