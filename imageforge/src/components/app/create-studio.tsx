"use client";
import { ArrowUp, ChevronDown, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ClientConfig } from "@/server/client-config";
import { GalleryGrid, useGalleryItems, type Item } from "./gallery-grid";
import { UsageMeter } from "./usage-meter";

type Outcome =
  | { status: "blocked"; jobId: string; message: string; reasons?: { category: string; matched?: string }[] }
  | { status: "succeeded"; jobId: string; images: { id: string; url: string; width: number; height: number }[]; warning?: string; revisedPrompt: string | null };

export type RemixSeed = { prompt: string; negativePrompt: string | null; aspectRatio: string; presetSlug: string | null; jobId: string } | null;

export function CreateStudio({ config, recent, remix }: { config: ClientConfig; recent: Item[]; remix: RemixSeed }) {
  const router = useRouter();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState(remix?.prompt ?? "");
  const [negative, setNegative] = useState(remix?.negativePrompt ?? "");
  const [showNegative, setShowNegative] = useState(Boolean(remix?.negativePrompt));
  const [aspect, setAspect] = useState(remix && config.aspectRatios.includes(remix.aspectRatio as never) ? remix.aspectRatio : (config.aspectRatios[0] ?? "1:1"));
  const [preset, setPreset] = useState<string | null>(remix?.presetSlug && config.presets.some((p) => p.slug === remix.presetSlug) ? remix.presetSlug : null);
  const [count, setCount] = useState(Math.min(2, config.maxImages));
  const [model, setModel] = useState(config.defaultModel);
  const [remixOf, setRemixOf] = useState<string | null>(remix?.jobId ?? null);
  const [pending, setPending] = useState<{ key: string; aspectRatio: string }[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(config.usage.remaining);
  const g = useGalleryItems(recent);
  const busy = pending.length > 0;

  // "/" focuses the prompt from anywhere (unless already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        promptRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // auto-grow textarea
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [prompt]);

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    if (remaining < count) {
      toast.error(remaining === 0 ? "You’ve used all your images for now." : `You have ${remaining} images left.`);
      return;
    }
    setRefusal(null);
    const keys = Array.from({ length: count }, (_, i) => ({ key: `p-${Date.now()}-${i}`, aspectRatio: aspect }));
    setPending(keys);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          negativePrompt: config.flags.negativePrompt && showNegative ? negative : null,
          aspectRatio: aspect,
          count,
          preset,
          model,
          remixOf: config.flags.remix ? remixOf : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as (Outcome & { error?: { message?: string } }) | null;
      if (res.status === 422 && data?.status === "blocked") {
        setRefusal(data.message);
        return;
      }
      if (!res.ok || !data || data.status !== "succeeded") {
        toast.error(data?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      if (data.warning) toast.warning(data.warning);
      const created: Item[] = data.images.map((im) => ({ ...im, favorite: false, prompt: text, negativePrompt: negative || null, aspectRatio: aspect }));
      g.setItems((xs) => [...created, ...xs]);
      setRemaining((r) => Math.max(0, r - created.length));
      setRemixOf(null);
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setPending([]);
    }
  }, [prompt, busy, remaining, count, aspect, config.flags, showNegative, negative, preset, model, remixOf, g, router]);

  const onRemix = config.flags.remix
    ? (it: Item) => {
        setPrompt(it.prompt);
        if (it.negativePrompt) {
          setNegative(it.negativePrompt);
          setShowNegative(true);
        }
        if (config.aspectRatios.includes(it.aspectRatio as never)) setAspect(it.aspectRatio);
        window.scrollTo({ top: 0, behavior: "smooth" });
        promptRef.current?.focus();
        toast("Prompt loaded — tweak it and generate.");
      }
    : undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <section className="pb-6 pt-4 sm:pt-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">What do you want to see?</h1>
            <UsageMeter remaining={remaining} limits={config.usage.limits} usedToday={config.usage.used.daily} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
            className="rounded-2xl border border-border bg-card/90 p-2 shadow-2xl backdrop-blur focus-within:border-accent/50"
          >
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void generate();
                }
              }}
              rows={3}
              maxLength={config.maxPromptLength}
              placeholder="A glass greenhouse on a cliff at dawn, mist rolling in, cinematic light…"
              aria-label="Prompt"
              data-testid="prompt"
              autoFocus
              className="block w-full resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed placeholder:text-muted/60 focus:outline-none"
            />
            {config.flags.negativePrompt && showNegative && (
              <input
                value={negative}
                onChange={(e) => setNegative(e.target.value)}
                placeholder="Avoid: text, watermark, extra fingers…"
                aria-label="Negative prompt"
                className="mx-1 mb-1 block w-[calc(100%-0.5rem)] rounded-lg border border-border bg-bg/60 px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none"
              />
            )}
            <div className="flex flex-wrap items-center gap-2 px-1 pb-1 pt-1">
              <ChipGroup label="Aspect ratio" value={aspect} options={config.aspectRatios} onChange={setAspect} mono />
              <ChipGroup label="Images" value={String(count)} options={Array.from({ length: config.maxImages }, (_, i) => String(i + 1))} onChange={(v) => setCount(Number(v))} mono />
              {config.models.length > 1 && (
                <label className="relative">
                  <span className="sr-only">Model</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 appearance-none rounded-lg border border-border bg-bg/60 pl-2.5 pr-7 text-xs text-muted focus:outline-none">
                    {config.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted" />
                </label>
              )}
              {config.flags.negativePrompt && (
                <button type="button" onClick={() => setShowNegative((v) => !v)} className={cn("h-8 rounded-lg px-2.5 text-xs", showNegative ? "bg-fg/10 text-fg" : "text-muted hover:text-fg")}>
                  Avoid…
                </button>
              )}
              <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[11px] text-muted sm:inline" title="Enter generates · Shift+Enter adds a new line">
                  ↵ generate · ⇧↵ new line
                </span>
              <button
                type="submit"
                disabled={!prompt.trim() || busy || config.models.length === 0}
                data-testid="generate"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] transition hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Sparkles className="h-4 w-4 animate-pulse" /> : <ArrowUp className="h-4 w-4" />}
                {busy ? "Generating" : "Generate"}
              </button>
              </div>
            </div>
          </form>

          {config.presets.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Style">
              <PresetChip active={preset === null} onClick={() => setPreset(null)} name="No style" />
              {config.presets.map((p) => (
                <PresetChip key={p.slug} active={preset === p.slug} onClick={() => setPreset(p.slug)} name={p.name} thumb={p.thumbnailUrl} />
              ))}
            </div>
          )}

          {config.models.length === 0 && <p className="mt-3 text-sm text-amber-500">Image generation is temporarily unavailable.</p>}

          {refusal && (
            <div role="alert" data-testid="refusal" className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{refusal}</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Recent</h2>
          {g.items.length > 0 && (
            <Link href="/gallery" className="text-xs text-muted hover:text-fg">
              View gallery →
            </Link>
          )}
        </div>
        {g.items.length === 0 && pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-accent" />
            <p className="mt-3 text-sm font-medium">Your first image is one prompt away</p>
            <p className="mt-1 text-sm text-muted">
              Press <kbd className="rounded border border-border px-1">/</kbd> to start typing.
            </p>
          </div>
        ) : (
          <GalleryGrid items={g.items} pending={pending} onFavorite={g.toggleFavorite} onDelete={g.remove} onShare={g.share} actions={{ onRemix, canShare: config.flags.publicShare }} />
        )}
      </section>
    </div>
  );
}

function ChipGroup({ label, value, options, onChange, mono }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div className="flex h-8 items-center rounded-lg bg-bg/60 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn("h-7 rounded-md px-2 text-xs transition", mono && "font-mono", value === o ? "bg-card text-fg shadow" : "text-muted hover:text-fg")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function PresetChip({ name, thumb, active, onClick }: { name: string; thumb?: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn("flex shrink-0 items-center gap-2 rounded-xl border py-1 pl-1 pr-3 text-xs transition", active ? "border-accent bg-accent/10 text-fg" : "border-border bg-card/60 text-muted hover:text-fg")}
    >
      {thumb ? <img src={thumb} alt="" className="h-7 w-7 rounded-lg object-cover" /> : <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent/50 to-fg/10" />}
      {name}
    </button>
  );
}
