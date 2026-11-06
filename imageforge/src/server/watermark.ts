import "server-only";
import sharp from "sharp";
import type { AppSettings } from "@/server/settings/schema";

type WM = AppSettings["generation"]["watermark"];

function esc(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Burns a text watermark into the image. Returns PNG. */
export async function applyWatermark(input: Buffer, wm: WM): Promise<Buffer> {
  const img = sharp(input);
  const meta = await img.metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.035));
  const pad = Math.round(size * 0.9);
  const pos = {
    br: { x: w - pad, y: h - pad, anchor: "end" },
    bl: { x: pad, y: h - pad, anchor: "start" },
    tr: { x: w - pad, y: pad + size, anchor: "end" },
    tl: { x: pad, y: pad + size, anchor: "start" },
    center: { x: w / 2, y: h / 2 + size / 3, anchor: "middle" },
  }[wm.position];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}" font-family="sans-serif" font-weight="700" font-size="${size}"
      fill="white" fill-opacity="${wm.opacity}" stroke="black" stroke-opacity="${wm.opacity * 0.4}" stroke-width="${Math.max(1, size / 18)}">${esc(wm.text || "IMAGEFORGE")}</text>
  </svg>`;
  return img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
