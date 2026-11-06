import Link from "next/link";
import { Logo } from "@/components/brand";
import { getBranding } from "@/server/branding";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo name={b.appName} logoUrl={b.logoUrl} />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/about" className="rounded-md px-3 py-1.5 text-muted hover:text-fg">About</Link>
          <Link href="/sign-in" className="rounded-md px-3 py-1.5 text-muted hover:text-fg">Sign in</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted">
        <span>© {new Date().getFullYear()} {b.appName}</span>
        <div className="flex flex-wrap gap-4">
          <Link href="/about" className="hover:text-fg">About</Link>
          <Link href="/terms" className="hover:text-fg">Terms</Link>
          {b.footerLinks.map((l) => (
            <a key={l.url} href={l.url} className="hover:text-fg" rel="noopener noreferrer" target="_blank">{l.label}</a>
          ))}
          {b.supportEmail && <a href={`mailto:${b.supportEmail}`} className="hover:text-fg">Support</a>}
        </div>
      </footer>
    </div>
  );
}
