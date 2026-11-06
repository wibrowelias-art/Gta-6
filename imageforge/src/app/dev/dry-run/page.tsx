import { asc } from "drizzle-orm";
import { DryRunPanel } from "@/components/dev/dry-run-panel";
import { db } from "@/server/db/client";
import { stylePresets } from "@/server/db/schema";
import { getSettings } from "@/server/settings/store";

export default async function DryRunPage() {
  const [s, presets] = await Promise.all([getSettings(), db.select({ slug: stylePresets.slug, name: stylePresets.name }).from(stylePresets).orderBy(asc(stylePresets.sortOrder))]);
  return <DryRunPanel breakGlassEnabled={s.devTools.breakGlass} presets={presets} />;
}
