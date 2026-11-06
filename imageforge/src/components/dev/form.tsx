"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { devMutate } from "./step-up";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0 sm:max-w-[60%]">{children}</div>
    </div>
  );
}

/** Local state for one top-level settings section with dirty tracking and a step-up-aware save. */
export function useSection<T>(section: string, initial: T) {
  const router = useRouter();
  const [value, setValue] = useState<T>(initial);
  const [base, setBase] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(base);
  async function save() {
    setSaving(true);
    const res = await devMutate<{ version: number }>("/api/dev/settings", { method: "PATCH", json: { patch: { [section]: value } } }, "Saved · live within 15s");
    setSaving(false);
    if (res) {
      setBase(value);
      router.refresh();
    }
  }
  const reset = () => setValue(base);
  return { value, setValue, save, reset, dirty, saving };
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur transition",
        dirty ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <span className="text-sm text-muted">Unsaved changes</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} data-testid="save-settings">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: readonly T[]; onChange: (v: T) => void; name?: string }) {
  return (
    <div className="inline-flex rounded-lg bg-fg/5 p-0.5" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs capitalize transition",
            value === o ? (o === "block" ? "bg-red-500/15 text-red-500" : o === "warn" ? "bg-amber-500/15 text-amber-500" : "bg-card text-fg shadow") : "text-muted hover:text-fg",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({ value, onChange, min, max, step, id, className }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; id?: string; className?: string }) {
  return (
    <input
      id={id}
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      className={cn("h-9 w-28 rounded-lg border border-border bg-bg px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    />
  );
}

export function ListInput({ value, onChange, placeholder, id, rows = 3 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea
      id={id}
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      className="w-full min-w-64 rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
