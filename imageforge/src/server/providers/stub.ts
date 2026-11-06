import { createHash } from "node:crypto";
import sharp from "sharp";
import { dimensionsFor } from "./sizes";
import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/** Offline provider: deterministic gradient art derived from the prompt. Used for local dev and tests. */
export const stubProvider: ImageProvider = {
  id: "stub",
  label: "Stub (offline)",
  knownModels: ["stub-v1"],
  isConfigured: () => true,
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (process.env.IMAGEFORGE_STUB_FAIL === "1") throw new Error("stub failure (forced)");
    const { width, height } = dimensionsFor(req.aspectRatio, 768);
    const images = await Promise.all(
      Array.from({ length: req.count }, async (_, i) => {
        const h = createHash("sha256").update(`${req.prompt}|${i}`).digest();
        const hue1 = h[0]! * 1.41;
        const hue2 = (hue1 + 40 + (h[1]! % 120)) % 360;
        const cx = 20 + (h[2]! % 60);
        const cy = 20 + (h[3]! % 60);
        const label = escapeXml(req.prompt.slice(0, 60));
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <defs>
            <radialGradient id="g" cx="${cx}%" cy="${cy}%" r="90%">
              <stop offset="0%" stop-color="hsl(${hue1},80%,62%)"/>
              <stop offset="55%" stop-color="hsl(${hue2},60%,28%)"/>
              <stop offset="100%" stop-color="hsl(${hue2},40%,8%)"/>
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
          <circle cx="${(cx / 100) * width}" cy="${(cy / 100) * height}" r="${Math.min(width, height) / 5}" fill="hsla(${hue1},90%,80%,.35)"/>
          <text x="24" y="${height - 28}" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,.75)">${label}</text>
        </svg>`;
        const data = await sharp(Buffer.from(svg)).png().toBuffer();
        return { data, mime: "image/png" };
      }),
    );
    return { images, model: req.model, seed: createHash("sha1").update(req.prompt).digest("hex").slice(0, 10), revisedPrompt: null };
  },
};

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
