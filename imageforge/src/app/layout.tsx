import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { getBranding } from "@/server/branding";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding();
  return { title: { default: b.appName, template: `%s · ${b.appName}` }, description: "One prompt. Beautiful images, fast." };
}

export const viewport: Viewport = { themeColor: "#08080a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [b, jar] = await Promise.all([getBranding(), cookies()]);
  const theme = jar.get("imageforge.theme")?.value === "light" ? "light" : "dark";
  const accent = /^#[0-9a-fA-F]{6}$/.test(b.accentColor) ? b.accentColor : "#8b5cf6";
  return (
    <html lang="en" className={theme === "dark" ? "dark" : ""} suppressHydrationWarning>
      <head>
        <style>{`:root{--accent:${accent}}`}</style>
        {b.css ? <style data-custom-css>{b.css}</style> : null}
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster theme={theme} position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
