import "server-only";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { generationJobs, images } from "@/server/db/schema";

export type GalleryItem = {
  id: string;
  url: string;
  width: number;
  height: number;
  favorite: boolean;
  isPublic: boolean;
  shareSlug: string | null;
  createdAt: string;
  jobId: string;
  prompt: string;
  negativePrompt: string | null;
  aspectRatio: string;
  model: string | null;
  presetId: string | null;
};

export async function listGallery(userId: string, opts: { cursor?: string; favorites?: boolean; limit?: number } = {}): Promise<{ items: GalleryItem[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? 30, 60);
  const rows = await db
    .select({ img: images, job: { prompt: generationJobs.normalizedPrompt, negativePrompt: generationJobs.negativePrompt, aspectRatio: generationJobs.aspectRatio, model: generationJobs.model, provider: generationJobs.provider, presetId: generationJobs.presetId } })
    .from(images)
    .innerJoin(generationJobs, eq(images.jobId, generationJobs.id))
    .where(
      and(
        eq(images.userId, userId),
        isNull(images.deletedAt),
        opts.favorites ? eq(images.favorite, true) : undefined,
        opts.cursor ? lt(images.createdAt, new Date(opts.cursor)) : undefined,
      ),
    )
    .orderBy(desc(images.createdAt), desc(images.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ img, job }) => ({
      id: img.id,
      url: `/api/images/${img.id}`,
      width: img.width,
      height: img.height,
      favorite: img.favorite,
      isPublic: img.isPublic,
      shareSlug: img.shareSlug,
      createdAt: img.createdAt.toISOString(),
      jobId: img.jobId,
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      aspectRatio: job.aspectRatio,
      model: job.provider && job.model ? `${job.provider}:${job.model}` : null,
      presetId: job.presetId,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]!.img.createdAt.toISOString() : null,
  };
}
