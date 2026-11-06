import { Logo } from "@/components/brand";
import { AppNav } from "@/components/app/app-nav";
import { getBranding } from "@/server/branding";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [u, b, s] = await Promise.all([requireUser(), getBranding(), getSettings()]);
  const maintenance = s.access.maintenance.enabled && u.role !== "developer";
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo name={b.appName} logoUrl={b.logoUrl} href="/create" />
          <AppNav />
        </div>
      </header>
      {s.access.maintenance.enabled && (
        <div role="status" className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-500">
          {s.access.maintenance.message}
          {u.role === "developer" && " (you can still generate as a developer)"}
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">{maintenance ? <MaintenanceNotice message={s.access.maintenance.message} /> : children}</main>
    </div>
  );
}

function MaintenanceNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-xl font-semibold">Down for maintenance</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
    </div>
  );
}
