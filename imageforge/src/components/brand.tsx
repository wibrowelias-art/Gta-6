import Link from "next/link";

export function Logo({ name, logoUrl, href = "/" }: { name: string; logoUrl?: string; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
      ) : (
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-bold text-white shadow-[0_0_20px_-4px_var(--accent)]">
          ◆
        </span>
      )}
      <span className="text-sm">{name}</span>
    </Link>
  );
}
