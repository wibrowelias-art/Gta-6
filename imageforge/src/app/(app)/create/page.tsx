import { and, eq } from "drizzle-orm";
import { CreateStudio, type RemixSeed } from "@/components/app/create-studio";
import { requireUser } from "@/server/auth/session";
import { getClientConfig } from "@/server/client-config";
import { db } from "@/server/db/client";
import { generationJobs, images, stylePresets } from "@/server/db/schema";
import { listGallery } from "@/server/gallery";

export const metadata = { title: "Create" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ remix?: string }> }) {
  const user = await requireUser();
  const { remix } = await searchParams;
  const [config, recent] = await Promise.all([getClientConfig(user), listGallery(user.id, { limit: 12 })]);

  let seed: RemixSeed = null;
  if (remix && config.flags.remix && /^[0-9a-f-]{36}$/i.test(remix)) {
    const [row] = await db
      .select({ prompt: generationJobs.normalizedPrompt, negativePrompt: generationJobs.negativePrompt, aspectRatio: generationJobs.aspectRatio, jobId: generationJobs.id, presetSlug: stylePresets.slug })
      .from(images)
      .innerJoin(generationJobs, eq(images.jobId, generationJobs.id))
      .leftJoin(stylePresets, eq(generationJobs.presetId, stylePresets.id))
      .where(and(eq(images.id, remix), eq(images.userId, user.id)))
      .limit(1);
    if (row) seed = { ...row, presetSlug: row.presetSlug ?? null };
  }
  return <CreateStudio config={config} recent={recent.items} remix={seed} />;
}
