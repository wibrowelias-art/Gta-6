import { UsersPanel } from "@/components/dev/users-panel";
import { requireDeveloper } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { plans } from "@/server/db/schema";
import { listUsers } from "@/server/users-admin";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireDeveloper();
  const { q } = await searchParams;
  const [users, allPlans] = await Promise.all([listUsers({ text: q }), db.select({ id: plans.id, name: plans.name }).from(plans)]);
  return <UsersPanel me={me.id} q={q ?? ""} plans={allPlans} users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />;
}
