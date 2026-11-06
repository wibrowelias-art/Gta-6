"use client";
import { ChevronLeft, ChevronRight, Download, Heart, Link2, Shuffle, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type Item = {
  id: string;
  url: string;
  width: number;
  height: number;
  favorite: boolean;
  isPublic?: boolean;
  shareSlug?: string | null;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: string;
  model?: string | null;
  createdAt?: string;
};

export type GalleryActions = {
  onRemix?: (item: Item) => void;
  canShare?: boolean;
};

/** Shared state for a list of images: optimistic favorite/delete/share. */
export function useGalleryItems(initial: Item[]) {
  const [items, setItems] = useState(initial);
  const update = (id: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const toggleFavorite = useCallback(async (item: Item) => {
    update(item.id, { favorite: !item.favorite });
    try {
      await api(`/api/images/${item.id}`, { method: "PATCH", json: { favorite: !item.favorite } });
    } catch {
      update(item.id, { favorite: item.favorite });
      toast.error("Couldn’t update favorite.");
    }
  }, []);

  const remove = useCallback(
    async (item: Item) => {
      const snapshot = items;
      setItems((xs) => xs.filter((x) => x.id !== item.id));
      try {
        await api(`/api/images/${item.id}`, { method: "DELETE" });
        toast.success("Deleted");
      } catch {
        setItems(snapshot);
        toast.error("Couldn’t delete that image.");
      }
    },
    [items],
  );

  const share = useCallback(async (item: Item) => {
    try {
      const res = await api<{ isPublic: boolean; shareSlug: string | null }>(`/api/images/${item.id}`, { method: "PATCH", json: { isPublic: !item.isPublic } });
      update(item.id, { isPublic: res.isPublic, shareSlug: res.shareSlug });
      if (res.isPublic && res.shareSlug) {
        const link = `${window.location.origin}/s/${res.shareSlug}`;
        await navigator.clipboard.writeText(link).catch(() => {});
        toast.success("Share link copied");
      } else toast.success("Image is private again");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn’t change sharing.");
    }
  }, []);

  return { items, setItems, toggleFavorite, remove, share };
}

export function GalleryGrid({
  items,
  actions,
  onFavorite,
  onDelete,
  onShare,
  pending = [],
}: {
  items: Item[];
  actions?: GalleryActions;
  onFavorite: (i: Item) => void;
  onDelete: (i: Item) => void;
  onShare?: (i: Item) => void;
  pending?: { key: string; aspectRatio: string }[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open !== null ? items[open] : undefined;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="gallery-grid">
        {pending.map((p) => (
          <div key={p.key} className="shimmer rounded-xl" style={{ aspectRatio: p.aspectRatio.replace(":", " / ") }} data-testid="skeleton" />
        ))}
        {items.map((it, i) => (
          <figure key={it.id} className="group relative overflow-hidden rounded-xl border border-border bg-card" style={{ aspectRatio: `${it.width || 1} / ${it.height || 1}` }}>
            <button type="button" className="block h-full w-full" onClick={() => setOpen(i)} aria-label="Open image">
              <img src={it.url} alt={it.prompt} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" data-testid="gallery-image" />
            </button>
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="line-clamp-2 text-left text-[11px] text-white/85">{it.prompt}</span>
              <div className="pointer-events-auto flex shrink-0 gap-1">
                <IconBtn label={it.favorite ? "Unfavorite" : "Favorite"} onClick={() => onFavorite(it)}>
                  <Heart className={cn("h-4 w-4", it.favorite && "fill-current text-rose-400")} />
                </IconBtn>
                <IconBtn label="Download" href={`${it.url}?download=1`}>
                  <Download className="h-4 w-4" />
                </IconBtn>
              </div>
            </figcaption>
            {it.favorite && <Heart className="absolute right-2 top-2 h-4 w-4 fill-rose-400 text-rose-400 drop-shadow group-hover:opacity-0" />}
          </figure>
        ))}
      </div>
      <Lightbox
        item={current}
        onClose={() => setOpen(null)}
        onPrev={open !== null && open > 0 ? () => setOpen(open - 1) : undefined}
        onNext={open !== null && open < items.length - 1 ? () => setOpen(open + 1) : undefined}
        onFavorite={onFavorite}
        onDelete={(it) => {
          setOpen(null);
          onDelete(it);
        }}
        onShare={actions?.canShare ? onShare : undefined}
        onRemix={
          actions?.onRemix
            ? (it) => {
                setOpen(null);
                actions.onRemix!(it);
              }
            : undefined
        }
      />
    </>
  );
}

function IconBtn({ label, onClick, href, children }: { label: string; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const cls = "grid h-8 w-8 place-items-center rounded-lg bg-black/50 text-white backdrop-blur hover:bg-black/70";
  return href ? (
    <a href={href} aria-label={label} title={label} className={cls} download>
      {children}
    </a>
  ) : (
    <button type="button" aria-label={label} title={label} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

function Lightbox({
  item,
  onClose,
  onPrev,
  onNext,
  onFavorite,
  onDelete,
  onRemix,
  onShare,
}: {
  item?: Item;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFavorite: (i: Item) => void;
  onDelete: (i: Item) => void;
  onRemix?: (i: Item) => void;
  onShare?: (i: Item) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setZoom(false);
    setConfirmDelete(false);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onPrev, onNext]);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent bare className="flex h-[92dvh] w-[96vw] max-w-6xl flex-col gap-3" data-testid="lightbox">
        {item && (
          <>
            <DialogTitle className="sr-only">Image preview</DialogTitle>
            <DialogDescription className="sr-only">{item.prompt}</DialogDescription>
            <div
              className={cn("relative min-h-0 flex-1 overflow-hidden rounded-xl", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
              onClick={() => setZoom((z) => !z)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
              }}
            >
              <img src={item.url} alt={item.prompt} className="h-full w-full object-contain transition-transform duration-200" style={{ transform: zoom ? "scale(2.2)" : "none", transformOrigin: origin }} />
              {onPrev && (
                <NavBtn side="left" onClick={onPrev}>
                  <ChevronLeft className="h-5 w-5" />
                </NavBtn>
              )}
              {onNext && (
                <NavBtn side="right" onClick={onNext}>
                  <ChevronRight className="h-5 w-5" />
                </NavBtn>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 p-3 text-white backdrop-blur">
              <p className="min-w-0 flex-1 text-sm text-white/85">
                {item.prompt}
                <span className="ml-2 font-mono text-[11px] text-white/45">
                  {item.aspectRatio}
                  {item.model ? ` · ${item.model}` : ""}
                </span>
              </p>
              <div className="flex gap-1">
                <IconBtn label={zoom ? "Zoom out" : "Zoom in"} onClick={() => setZoom((z) => !z)}>
                  {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                </IconBtn>
                <IconBtn label={item.favorite ? "Unfavorite" : "Favorite"} onClick={() => onFavorite(item)}>
                  <Heart className={cn("h-4 w-4", item.favorite && "fill-current text-rose-400")} />
                </IconBtn>
                {onRemix && (
                  <IconBtn label="Remix" onClick={() => onRemix(item)}>
                    <Shuffle className="h-4 w-4" />
                  </IconBtn>
                )}
                {onShare && (
                  <IconBtn label={item.isPublic ? "Make private" : "Copy share link"} onClick={() => onShare(item)}>
                    <Link2 className={cn("h-4 w-4", item.isPublic && "text-emerald-400")} />
                  </IconBtn>
                )}
                <IconBtn label="Download" href={`${item.url}?download=1`}>
                  <Download className="h-4 w-4" />
                </IconBtn>
                {confirmDelete ? (
                  <button type="button" className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium" onClick={() => onDelete(item)}>
                    Delete forever
                  </button>
                ) : (
                  <IconBtn label="Delete" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavBtn({ side, onClick, children }: { side: "left" | "right"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70", side === "left" ? "left-3" : "right-3")}
    >
      {children}
    </button>
  );
}
