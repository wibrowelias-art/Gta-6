import { desc, eq, sql } from "drizzle-orm";
import { Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generationJobs, images } from "@/server/db/schema";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();
  const jobs = await db
    .select({
      id: generationJobs.id,
      prompt: generationJobs.normalizedPrompt,
      status: generationJobs.status,
      aspectRatio: generationJobs.aspectRatio,
      count: generationJobs.count,
      createdAt: generationJobs.createdAt,
      error: generationJobs.errorMessageSafe,
      firstImage: sql<string | null>`(select ${images.id} from ${images} where ${images.jobId} = ${generationJobs.id} and ${images.deletedAt} is null order by ${images.createdAt} limit 1)`,
    })
    .from(generationJobs)
    .where(eq(generationJobs.userId, user.id))
    .orderBy(desc(generationJobs.createdAt))
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-xl font-semibold tracking-tight">History</h1>
      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <Clock className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-3 text-sm font-medium">No prompts yet</p>
          <p className="mt-1 text-sm text-muted">Every prompt you run is listed here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center gap-3 px-4 py-3">
              {j.firstImage ? (
                <img src={`/api/images/${j.firstImage}`} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-lg bg-fg/5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{j.prompt}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(j.createdAt)} · {j.aspectRatio} · {j.count}×
                  {j.status === "failed" && j.error ? ` · ${j.error}` : ""}
                </p>
              </div>
              <Badge tone={j.status === "succeeded" ? "good" : j.status === "blocked" ? "bad" : j.status === "failed" ? "warn" : "default"}>
                {j.status === "blocked" ? "refused" : j.status}
              </Badge>
              {j.firstImage && (
                <Link href={`/create?remix=${j.firstImage}`} className="text-xs text-muted hover:text-fg">
                  Remix
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
