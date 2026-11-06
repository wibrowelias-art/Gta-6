import "server-only";
import { defaultSettings } from "@/server/settings/defaults";
import type { AppSettings } from "@/server/settings/schema";
import { getSettings } from "@/server/settings/store";
import { sanitizeCss } from "@/server/sanitize-css";

export type PublicBranding = AppSettings["branding"] & { css: string };

/** Only branding (non-secret) is exposed to pages. */
export async function getBranding(): Promise<PublicBranding> {
  let b: AppSettings["branding"];
  try {
    b = (await getSettings()).branding;
  } catch {
    b = defaultSettings().branding;
  }
  return { ...b, css: sanitizeCss(b.customCss) };
}
