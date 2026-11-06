import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { hasStepUp } from "@/server/auth/step-up";
import { db } from "@/server/db/client";
import { stylePresets } from "@/server/db/schema";
import { fail, handler, ok, readJson } from "@/server/http";
import { runGeneration } from "@/server/pipeline/generate";
import { evaluatePolicy } from "@/server/policy/engine";
import { normalizePrompt } from "@/server/policy/normalize";
import { getConfig } from "@/server/settings/store";

const body = z.object({
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional().nullable(),
  preset: z.string().max(80).optional().nullable(),
  generate: z.boolean().default(false),
  breakGlass: z.boolean().default(false),
});

/**
 * Policy dry-run. Evaluate-only by default (nothing stored, no provider call).
 * With generate=true it runs the real pipeline as source "dry-run"; with
 * breakGlass=true (and the settings flag on) configurable rules are skipped —
 * child safety still runs first and again before the provider call.
 */
export const POST = handler(async (req: Request) => {
  const { user, meta, actor } = await requireDevApi(req);
  const b = body.parse(await readJson(req));
  const cfg = await getConfig();
  const preset = b.preset ? await db.query.stylePresets.findFirst({ where: and(eq(stylePresets.slug, b.preset)) }) : undefined;
  const finalPrompt = [preset?.promptPrefix?.trim(), normalizePrompt(b.prompt), preset?.promptSuffix?.trim()].filter(Boolean).join(", ");
  const text = [finalPrompt, b.negativePrompt].filter(Boolean).join("\n");
  const normal = evaluatePolicy(text, { policy: cfg.settings.policy, rules: cfg.rules });
  const glass = evaluatePolicy(text, { policy: cfg.settings.policy, rules: cfg.rules, bypassConfigurable: true });

  if (!b.generate) return ok({ version: cfg.version, finalPrompt, decision: normal, breakGlassDecision: glass });

  if (!(await hasStepUp(user.id))) return fail(401, "STEP_UP_REQUIRED", "Confirm it’s you with your developer PIN or authenticator code.");
  if (b.breakGlass && !cfg.settings.devTools.breakGlass) return fail(403, "BREAK_GLASS_OFF", "Turn on Break glass in Access & flags first.");
  if (b.breakGlass) await writeAudit({ actor, action: "dev.break_glass.generate", targetType: "policy", after: { prompt: b.prompt.slice(0, 200), decision: normal.action }, meta });
  const outcome = await runGeneration(user, meta, { prompt: b.prompt, negativePrompt: b.negativePrompt, preset: b.preset, count: 1 }, { source: "dry-run", breakGlass: b.breakGlass });
  return ok({ version: cfg.version, finalPrompt, decision: normal, breakGlassDecision: glass, outcome });
});
