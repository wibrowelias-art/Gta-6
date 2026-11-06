"use client";
import { cn } from "@/lib/utils";

export function UsageMeter({ remaining, limits, usedToday }: { remaining: number; limits: { daily: number; monthly: number }; usedToday: number }) {
  const pct = limits.daily > 0 ? Math.min(100, (usedToday / limits.daily) * 100) : 100;
  const low = remaining <= Math.max(1, Math.round(limits.daily * 0.1));
  return (
    <div className="flex items-center gap-2 text-xs text-muted" title={`${usedToday}/${limits.daily} today · ${limits.monthly} per month`} data-testid="usage-meter">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-fg/10" aria-hidden>
        <div className={cn("h-full rounded-full transition-all", low ? "bg-amber-500" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("tabular-nums", low && "text-amber-500")}>
        <span data-testid="remaining">{remaining}</span> left
      </span>
    </div>
  );
}
