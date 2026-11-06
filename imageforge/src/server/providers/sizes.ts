import type { AspectRatio } from "@/server/settings/schema";

export function ratio(a: AspectRatio): [number, number] {
  const [w, h] = a.split(":").map(Number);
  return [w ?? 1, h ?? 1];
}

/** Pixel size for a ratio with the long edge ≈ `long`, rounded to multiples of 16. */
export function dimensionsFor(a: AspectRatio, long = 1024) {
  const [w, h] = ratio(a);
  const r16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  return w >= h ? { width: r16(long), height: r16((long * h) / w) } : { width: r16((long * w) / h), height: r16(long) };
}

/** OpenAI gpt-image-1 supports 1024x1024, 1536x1024, 1024x1536. */
export function openAiSize(a: AspectRatio): "1024x1024" | "1536x1024" | "1024x1536" {
  const [w, h] = ratio(a);
  if (w === h) return "1024x1024";
  return w > h ? "1536x1024" : "1024x1536";
}

/** Imagen supports 1:1, 3:4, 4:3, 9:16, 16:9. */
export function imagenRatio(a: AspectRatio): string {
  const map: Record<AspectRatio, string> = { "1:1": "1:1", "4:3": "4:3", "3:4": "3:4", "3:2": "4:3", "2:3": "3:4", "16:9": "16:9", "9:16": "9:16" };
  return map[a];
}
