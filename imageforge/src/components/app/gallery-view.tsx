"use client";
import { Images } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GalleryGrid, useGalleryItems, type Item } from "./gallery-grid";

export function GalleryView({ initial, nextCursor, remix, share }: { initial: Item[]; nextCursor: string | null; remix: boolean; share: boolean }) {
  const router = useRouter();
  const g = useGalleryItems(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const shown = onlyFav ? g.items.filter((i) => i.favorite) : g.items;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Gallery</h1>
        <div className="flex rounded-lg bg-fg/5 p-0.5 text-xs">
          {[
            ["All", false],
            ["Favorites", true],
          ].map(([label, v]) => (
            <button key={String(label)} type="button" onClick={() => setOnlyFav(v as boolean)} className={cn("rounded-md px-3 py-1", onlyFav === v ? "bg-card text-fg shadow" : "text-muted")}>
              {label as string}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <Images className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-3 text-sm font-medium">{onlyFav ? "No favorites yet" : "Nothing here yet"}</p>
          <p className="mt-1 text-sm text-muted">{onlyFav ? "Tap the heart on any image to keep it here." : "Images you generate show up here, private to you."}</p>
          {!onlyFav && (
            <Button asChild className="mt-5" size="sm">
              <Link href="/create">Create something</Link>
            </Button>
          )}
        </div>
      ) : (
        <GalleryGrid
          items={shown}
          onFavorite={g.toggleFavorite}
          onDelete={g.remove}
          onShare={g.share}
          actions={{ onRemix: remix ? (it) => router.push(`/create?remix=${it.id}`) : undefined, canShare: share }}
        />
      )}
      {cursor && !onlyFav && (
        <div className="mt-6 text-center">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const res = await api<{ items: Item[]; nextCursor: string | null }>(`/api/gallery?cursor=${encodeURIComponent(cursor)}`);
                g.setItems((xs) => [...xs, ...res.items.filter((n) => !xs.some((x) => x.id === n.id))]);
                setCursor(res.nextCursor);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
