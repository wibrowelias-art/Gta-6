import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { writeAudit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generationJobs, images, refusalEvents, stylePresets } from "@/server/db/schema";
import { HttpError } from "@/server/http";
import { CHILD_SAFETY_CATEGORY, ChildSafetyViolation } from "@/server/policy/child-safety";
import { evaluatePolicy, safeRewrite, type PolicyDecision } from "@/server/policy/engine";
import { normalizePrompt } from "@/server/policy/normalize";
import { callProvider, planAttempts } from "@/server/providers/registry";
import { ProviderError } from "@/server/providers/types";
import { consumeQuota, getUsage } from "@/server/quota";
import { hit } from "@/server/rate-limit";
import type { ReqMeta } from "@/server/request";
import { aspectRatioSchema, type ProviderId } from "@/server/settings/schema";
import { getConfig } from "@/server/settings/store";
import { getStorage } from "@/server/storage";
import { applyWatermark } from "@/server/watermark";

export const generateInputSchema = z.object({
  prompt: z.string().min(1, "Write a prompt first.").max(10_000),
  negativePrompt: z.string().max(2_000).optional().nullable(),
  aspectRatio: aspectRatioSchema.default("1:1"),
  count: z.number().int().min(1).max(4).default(1),
  preset: z.string().max(80).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  remixOf: z.string().uuid().optional().nullable(),
});
export type GenerateInput = z.infer<typeof generateInputSchema>;

export type GenerateOutcome =
  | { status: "blocked"; jobId: string; message: string; reasons?: PolicyDecision["reasons"] }
  | {
      status: "succeeded";
      jobId: string;
      images: { id: string; url: string; width: number; height: number }[];
      warning?: string;
      revisedPrompt: string | null;
      provider: ProviderId;
      model: string;
    };

type Source = "web" | "remix" | "api" | "dry-run";

const STALE_JOB_MS = 5 * 60_000;

/**
 * The generation pipeline. Order matters:
 *   auth (caller) → maintenance → rate limit → validate → concurrency → quota →
 *   normalize → preset → POLICY (child safety first) → [safe rewrite] →
 *   job row → provider (child safety re-checked inside callProvider) with
 *   timeout + one fallback → watermark → storage → images → quota → done.
 * On block: no provider call, nothing stored, no quota used.
 */
export async function runGeneration(
  user: CurrentUser,
  meta: ReqMeta,
  raw: unknown,
  opts: { source: Source; breakGlass?: boolean } = { source: "web" },
): Promise<GenerateOutcome> {
  const cfg = await getConfig();
  const s = cfg.settings;
  const isDev = user.role === "developer";

  if (s.access.maintenance.enabled && !isDev) throw new HttpError(503, "MAINTENANCE", s.access.maintenance.message);

  const [ipHit, userHit] = await Promise.all([
    meta.ip ? hit(`gen:ip:${meta.ip}`, s.access.rateLimits.perIpPerMin) : Promise.resolve({ ok: true }),
    hit(`gen:user:${user.id}`, s.access.rateLimits.perUserPerMin),
  ]);
  if (!ipHit.ok || !userHit.ok) throw new HttpError(429, "RATE_LIMITED", "You’re going a bit fast. Try again in a minute.");

  const input = generateInputSchema.parse(raw);
  const source: Source = opts.source === "web" && input.remixOf ? "remix" : opts.source;
  if (source === "remix" && !s.access.flags.remix) throw new HttpError(403, "REMIX_DISABLED", "Remix is turned off.");

  const prompt = normalizePrompt(input.prompt);
  if (!prompt) throw new HttpError(400, "EMPTY_PROMPT", "Write a prompt first.");
  if (prompt.length > s.generation.maxPromptLength) {
    throw new HttpError(400, "PROMPT_TOO_LONG", `Keep prompts under ${s.generation.maxPromptLength} characters.`);
  }
  if (!s.generation.aspectRatios.includes(input.aspectRatio)) throw new HttpError(400, "ASPECT_NOT_ALLOWED", "That aspect ratio isn’t available.");
  const modelId = input.model || s.generation.defaultModel;
  if (!s.generation.allowedModels.includes(modelId)) throw new HttpError(400, "MODEL_NOT_ALLOWED", "That model isn’t available.");

  const usage = await getUsage(user, s);
  const maxCount = Math.min(s.generation.maxImagesPerRequest, user.role === "user" ? usage.maxImagesPerRequest : 4);
  if (input.count > maxCount) throw new HttpError(400, "TOO_MANY_IMAGES", `You can make up to ${maxCount} images at once.`);

  const [active] = await db
    .select({ n: count() })
    .from(generationJobs)
    .where(and(eq(generationJobs.userId, user.id), inArray(generationJobs.status, ["queued", "running"]), gte(generationJobs.createdAt, new Date(Date.now() - STALE_JOB_MS))));
  if ((active?.n ?? 0) >= s.generation.maxConcurrentJobsPerUser) {
    throw new HttpError(429, "TOO_MANY_JOBS", "Wait for your current images to finish.");
  }
  if (usage.remaining < input.count) {
    throw new HttpError(429, "QUOTA_EXCEEDED", usage.remaining === 0 ? "You’ve used all your images for now." : `You have ${usage.remaining} images left.`, {
      remaining: usage.remaining,
    });
  }

  let negative = s.access.flags.negativePrompt && input.negativePrompt ? normalizePrompt(input.negativePrompt) || null : null;

  let preset: typeof stylePresets.$inferSelect | undefined;
  if (input.preset) {
    preset = await db.query.stylePresets.findFirst({ where: and(eq(stylePresets.slug, input.preset), eq(stylePresets.enabled, true)) });
    if (!preset) throw new HttpError(400, "PRESET_NOT_FOUND", "That style isn’t available.");
  }
  let finalPrompt = [preset?.promptPrefix?.trim(), prompt, preset?.promptSuffix?.trim()].filter(Boolean).join(", ");
  if (!negative && preset?.negativeDefault && s.access.flags.negativePrompt) negative = preset.negativeDefault;

  // ---- policy (child safety runs first inside evaluatePolicy; break-glass cannot skip it)
  const bypass = source === "dry-run" && isDev && Boolean(opts.breakGlass) && s.devTools.breakGlass;
  const decision = evaluatePolicy([finalPrompt, negative].filter(Boolean).join("\n"), { policy: s.policy, rules: cfg.rules, bypassConfigurable: bypass });

  const baseJob = {
    userId: user.id,
    prompt: input.prompt.slice(0, 10_000),
    negativePrompt: negative,
    normalizedPrompt: prompt,
    presetId: preset?.id ?? null,
    aspectRatio: input.aspectRatio,
    count: input.count,
    policyVersion: cfg.version,
    policyAction: decision.action,
    policyReasons: decision.reasons,
    source,
  } as const;

  if (decision.action === "block") {
    return recordBlock(user, meta, baseJob, decision, s.policy.refusalMessage, finalPrompt);
  }

  let revisedPrompt: string | null = null;
  if (decision.action === "warn" && s.policy.safeRewrite) {
    finalPrompt = safeRewrite(finalPrompt, decision);
    revisedPrompt = finalPrompt;
  }

  const [job] = await db.insert(generationJobs).values({ ...baseJob, status: "queued", revisedPrompt }).returning({ id: generationJobs.id });
  const jobId = job!.id;

  const attempts = planAttempts(s, modelId).slice(0, 2); // primary + one fallback
  if (attempts.length === 0) {
    await failJob(jobId, "NO_PROVIDER", "No image provider is available right now.");
    throw new HttpError(503, "PROVIDER_UNAVAILABLE", "Image generation is unavailable right now. Please try again later.", { jobId });
  }

  const started = Date.now();
  let lastError: unknown = null;
  for (const [i, attempt] of attempts.entries()) {
    await db.update(generationJobs).set({ status: "running", attempt: i + 1, provider: attempt.provider, model: attempt.model, startedAt: new Date() }).where(eq(generationJobs.id, jobId));
    try {
      const result = await callProvider(attempt.provider, {
        prompt: finalPrompt,
        negativePrompt: negative,
        aspectRatio: input.aspectRatio,
        count: input.count,
        model: attempt.model,
        signal: AbortSignal.timeout(s.generation.providerTimeoutMs),
      });
      const storage = getStorage();
      const now = new Date();
      const expiresAt = s.generation.retentionDays > 0 ? new Date(now.getTime() + s.generation.retentionDays * 86400_000) : null;
      const rows = [];
      for (const [idx, img] of result.images.slice(0, input.count).entries()) {
        const data = s.generation.watermark.enabled ? await applyWatermark(img.data, s.generation.watermark) : img.data;
        const m = await sharp(data).metadata();
        const mime = s.generation.watermark.enabled ? "image/png" : img.mime;
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
        const key = await storage.put(`u/${user.id}/${jobId}/${idx}.${ext}`, data, mime);
        rows.push({ jobId, userId: user.id, storageKey: key, width: m.width ?? 0, height: m.height ?? 0, mime, bytes: data.length, watermarked: s.generation.watermark.enabled, expiresAt });
      }
      const inserted = await db.insert(images).values(rows).returning({ id: images.id, width: images.width, height: images.height });
      await consumeQuota(user.id, inserted.length);
      const latencyMs = Date.now() - started;
      await db
        .update(generationJobs)
        .set({
          status: "succeeded",
          provider: attempt.provider,
          model: result.model,
          seed: result.seed ?? null,
          revisedPrompt: revisedPrompt ?? result.revisedPrompt ?? null,
          costEstimateUsd: String((s.providers.costPerImageUsd[attempt.provider] ?? 0) * inserted.length),
          latencyMs,
          finishedAt: new Date(),
        })
        .where(eq(generationJobs.id, jobId));
      return {
        status: "succeeded",
        jobId,
        images: inserted.map((r) => ({ ...r, url: `/api/images/${r.id}` })),
        warning: decision.action === "warn" ? "Heads up: parts of this prompt were flagged, so results may be toned down." : undefined,
        revisedPrompt: revisedPrompt ?? result.revisedPrompt ?? null,
        provider: attempt.provider,
        model: result.model,
      };
    } catch (e) {
      if (e instanceof ChildSafetyViolation) {
        // Second gate tripped (should be unreachable after the engine). Never retried.
        await db.update(generationJobs).set({ status: "blocked", policyAction: "block", errorCode: e.code, finishedAt: new Date() }).where(eq(generationJobs.id, jobId));
        await logRefusal(user, meta, [{ category: CHILD_SAFETY_CATEGORY, action: "block", hard: true }], finalPrompt, source);
        return { status: "blocked", jobId, message: s.policy.refusalMessage };
      }
      lastError = e;
      console.error(`[generate] ${attempt.provider} failed`, e instanceof ProviderError ? `${e.code}` : e instanceof Error ? e.message : e);
      if (e instanceof ProviderError && !e.retryable) break;
    }
  }
  const code = lastError instanceof ProviderError ? lastError.code : lastError instanceof Error && lastError.name === "TimeoutError" ? "TIMEOUT" : "PROVIDER_ERROR";
  await failJob(jobId, code, "The image service didn’t respond. Please try again.", Date.now() - started);
  throw new HttpError(502, "GENERATION_FAILED", "The image service didn’t respond. Please try again.", { jobId });
}

async function failJob(jobId: string, code: string, message: string, latencyMs?: number) {
  await db.update(generationJobs).set({ status: "failed", errorCode: code.slice(0, 80), errorMessageSafe: message, finishedAt: new Date(), latencyMs: latencyMs ?? null }).where(eq(generationJobs.id, jobId));
}

async function recordBlock(
  user: CurrentUser,
  meta: ReqMeta,
  baseJob: Omit<typeof generationJobs.$inferInsert, "status">,
  decision: PolicyDecision,
  refusalMessage: string,
  text: string,
): Promise<GenerateOutcome> {
  const [job] = await db
    .insert(generationJobs)
    .values({ ...baseJob, status: "blocked", errorCode: decision.hard ? "CHILD_SAFETY_BLOCK" : "POLICY_BLOCK", finishedAt: new Date() })
    .returning({ id: generationJobs.id });
  await logRefusal(user, meta, decision.reasons.filter((r) => r.action === "block"), text, baseJob.source ?? "web");
  if (decision.hard) {
    await writeAudit({ actor: { id: user.id, email: user.email }, action: "policy.child_safety_block", targetType: "generation_job", targetId: job!.id, after: { source: baseJob.source }, meta });
  }
  return { status: "blocked", jobId: job!.id, message: refusalMessage, reasons: user.role === "developer" ? decision.reasons : undefined };
}

async function logRefusal(user: CurrentUser, meta: ReqMeta, reasons: PolicyDecision["reasons"], text: string, source: Source) {
  const promptHash = createHash("sha256").update(text).digest("hex");
  if (reasons.length === 0) return;
  await db.insert(refusalEvents).values(
    reasons.map((r) => ({
      userId: user.id,
      ip: meta.ip,
      category: r.category,
      ruleId: r.ruleId ?? null,
      hard: Boolean(r.hard),
      promptHash,
      excerpt: r.hard ? text.slice(0, 120) : null,
      source,
    })),
  );
}
