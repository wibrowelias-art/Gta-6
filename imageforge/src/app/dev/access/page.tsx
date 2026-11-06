import { desc } from "drizzle-orm";
import { AccessPanel } from "@/components/dev/access-panel";
import { db } from "@/server/db/client";
import { invites } from "@/server/db/schema";
import { getConfigUncached } from "@/server/settings/store";

export default async function AccessPage() {
  const [cfg, inv] = await Promise.all([getConfigUncached(), db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50)]);
  return (
    <AccessPanel
      access={cfg.settings.access}
      devTools={cfg.settings.devTools}
      invites={inv.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString(), usedAt: i.usedAt?.toISOString() ?? null }))}
    />
  );
}
