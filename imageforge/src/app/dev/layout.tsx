import type { Metadata } from "next";
import Link from "next/link";
import { DevNav } from "@/components/dev/dev-nav";
import { StepUpProvider, StepUpStatus } from "@/components/dev/step-up";
import { requireDeveloper } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Console", robots: { index: false, follow: false } };

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const u = await requireDeveloper();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border p-4 md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between md:block">
          <Link href="/dev" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-fg text-[11px] text-bg">◆</span> Developer console
          </Link>
          <p className="mt-1 hidden truncate text-xs text-muted md:block">{u.email}</p>
        </div>
        <DevNav />
        <div className="mt-4 space-y-2">
          <StepUpStatus />
          <Link href="/create" className="block px-1 text-xs text-muted hover:text-fg">← Back to app</Link>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-8">{children}</main>
      <StepUpProvider />
    </div>
  );
}
