import "server-only";
import { env } from "@/server/env";
import { openAiSize } from "./sizes";
import { ProviderError, type GenerateRequest, type GenerateResult, type ImageProvider } from "./types";

export const openaiProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI Images",
  knownModels: ["gpt-image-1"],
  isConfigured: () => Boolean(env.OPENAI_API_KEY),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new ProviderError("openai", "NOT_CONFIGURED", "OpenAI key missing", true);
    const prompt = req.negativePrompt ? `${req.prompt}\n\nAvoid: ${req.negativePrompt}` : req.prompt;
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      signal: req.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: req.model, prompt, n: req.count, size: openAiSize(req.aspectRatio) }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; type?: string } };
      const code = body.error?.code ?? body.error?.type ?? `HTTP_${res.status}`;
      // Provider-side safety refusals are not retried elsewhere.
      const retryable = !(res.status === 400 && /safety|moderation|content_policy/i.test(code));
      throw new ProviderError("openai", code, `OpenAI error ${res.status}`, retryable);
    }
    const json = (await res.json()) as { data?: { b64_json?: string; revised_prompt?: string }[] };
    const images = (json.data ?? []).filter((d) => d.b64_json).map((d) => ({ data: Buffer.from(d.b64_json!, "base64"), mime: "image/png" }));
    if (images.length === 0) throw new ProviderError("openai", "EMPTY", "No images returned");
    return { images, model: req.model, revisedPrompt: json.data?.[0]?.revised_prompt ?? null };
  },
};
