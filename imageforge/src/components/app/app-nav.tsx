"use client";
import { Clock, Images, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const items = [
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const path = usePathname();
  const router = useRouter();
  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        {items.map(({ href, label }) => (
          <Link key={href} href={href} className={cn("rounded-md px-3 py-1.5 text-sm transition", path.startsWith(href) ? "bg-fg/5 text-fg" : "text-muted hover:text-fg")}>
            {label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:text-fg md:inline-flex"
        onClick={async () => {
          await authClient.signOut();
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </>
  );
}

export function MobileTabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px]", path.startsWith(href) ? "text-fg" : "text-muted")}>
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
