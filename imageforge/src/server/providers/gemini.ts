import "server-only";
import { env } from "@/server/env";
import { imagenRatio } from "./sizes";
import { ProviderError, type GenerateRequest, type GenerateResult, type ImageProvider } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google image models. `imagen-*` models use :predict (batch); Gemini native
 * image models (e.g. gemini-2.5-flash-image) use :generateContent, one image per call.
 * The key is sent as a header, never in the URL.
 */
export const geminiProvider: ImageProvider = {
  id: "gemini",
  label: "Google Gemini / Imagen",
  knownModels: ["imagen-4.0-generate-001", "imagen-4.0-fast-generate-001", "gemini-2.5-flash-image"],
  isConfigured: () => Boolean(env.GEMINI_API_KEY),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const key = env.GEMINI_API_KEY;
    if (!key) throw new ProviderError("gemini", "NOT_CONFIGURED", "Gemini key missing", true);
    const headers = { "x-goog-api-key": key, "Content-Type": "application/json" };
    const prompt = req.negativePrompt ? `${req.prompt}. Avoid: ${req.negativePrompt}` : req.prompt;

    if (req.model.startsWith("imagen")) {
      const res = await fetch(`${BASE}/${encodeURIComponent(req.model)}:predict`, {
        method: "POST",
        signal: req.signal,
        headers,
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: req.count, aspectRatio: imagenRatio(req.aspectRatio) } }),
      });
      if (!res.ok) throw new ProviderError("gemini", `HTTP_${res.status}`, `Imagen error ${res.status}`, res.status >= 500 || res.status === 429);
      const json = (await res.json()) as { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] };
      const images = (json.predictions ?? []).filter((p) => p.bytesBase64Encoded).map((p) => ({ data: Buffer.from(p.bytesBase64Encoded!, "base64"), mime: p.mimeType ?? "image/png" }));
      if (images.length === 0) throw new ProviderError("gemini", "EMPTY", "No images returned (possibly filtered)", false);
      return { images, model: req.model };
    }

    const one = async () => {
      const res = await fetch(`${BASE}/${encodeURIComponent(req.model)}:generateContent`, {
        method: "POST",
        signal: req.signal,
        headers,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\nAspect ratio: ${req.aspectRatio}.` }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: imagenRatio(req.aspectRatio) } },
        }),
      });
      if (!res.ok) throw new ProviderError("gemini", `HTTP_${res.status}`, `Gemini error ${res.status}`, res.status >= 500 || res.status === 429);
      const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new ProviderError("gemini", "EMPTY", "No image returned (possibly filtered)", false);
      return { data: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType ?? "image/png" };
    };
    const images = await Promise.all(Array.from({ length: req.count }, one));
    return { images, model: req.model };
  },
};
