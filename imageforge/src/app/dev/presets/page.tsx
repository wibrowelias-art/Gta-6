import { asc } from "drizzle-orm";
import { PresetsPanel } from "@/components/dev/presets-panel";
import { db } from "@/server/db/client";
import { stylePresets } from "@/server/db/schema";

export default async function PresetsPage() {
  const rows = await db.select().from(stylePresets).orderBy(asc(stylePresets.sortOrder), asc(stylePresets.name));
  return <PresetsPanel presets={rows.map((r) => ({ ...r, createdAt: undefined, updatedAt: undefined }))} />;
}
