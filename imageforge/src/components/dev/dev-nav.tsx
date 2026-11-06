"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const DEV_SECTIONS = [
  { href: "/dev", label: "Overview" },
  { href: "/dev/policy", label: "Content policy" },
  { href: "/dev/generation", label: "Generation & quotas" },
  { href: "/dev/presets", label: "Style presets" },
  { href: "/dev/access", label: "Access & flags" },
  { href: "/dev/providers", label: "Providers" },
  { href: "/dev/branding", label: "Branding" },
  { href: "/dev/billing", label: "Plans & billing" },
  { href: "/dev/users", label: "Users" },
  { href: "/dev/audit", label: "Audit log" },
  { href: "/dev/dry-run", label: "Policy dry-run" },
  { href: "/dev/data", label: "Import / export" },
  { href: "/dev/security", label: "Security" },
];

export function DevNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {DEV_SECTIONS.map((s) => {
        const active = s.href === "/dev" ? path === "/dev" : path.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm", active ? "bg-fg/5 text-fg" : "text-muted hover:text-fg")}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
