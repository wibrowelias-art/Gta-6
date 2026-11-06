import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { generationJobs, images } from "@/server/db/schema";
import { getBranding } from "@/server/branding";
import { getSettings } from "@/server/settings/store";

export const metadata = { robots: { index: false } };

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSettings();
  if (!s.access.flags.publicShare) notFound();
  const [row] = await db
    .select({ id: images.id, prompt: generationJobs.normalizedPrompt, width: images.width, height: images.height })
    .from(images)
    .innerJoin(generationJobs, eq(images.jobId, generationJobs.id))
    .where(and(eq(images.shareSlug, slug), eq(images.isPublic, true), isNull(images.deletedAt)))
    .limit(1);
  if (!row) notFound();
  const b = await getBranding();
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <figure className="max-w-3xl">
        <img src={`/api/images/${row.id}`} alt={row.prompt} width={row.width} height={row.height} className="max-h-[80dvh] w-auto rounded-2xl border border-border" />
        <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-muted">
          <span className="line-clamp-2">{row.prompt}</span>
          <Link href="/" className="shrink-0 text-fg">
            Made with {b.appName}
          </Link>
        </figcaption>
      </figure>
    </main>
  );
}
