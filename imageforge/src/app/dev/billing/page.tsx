import { asc } from "drizzle-orm";
import { PlansPanel } from "@/components/dev/plans-panel";
import { db } from "@/server/db/client";
import { plans } from "@/server/db/schema";
import { env } from "@/server/env";

export default async function BillingPage() {
  const rows = await db.select().from(plans).orderBy(asc(plans.dailyQuota));
  return <PlansPanel plans={rows} stripe={Boolean(env.STRIPE_SECRET_KEY)} />;
}
