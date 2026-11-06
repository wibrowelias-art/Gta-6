import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db/client";
import { user as userTable, type UserRow } from "@/server/db/schema";
import { auth } from "./auth";

export type CurrentUser = Pick<UserRow, "id" | "email" | "name" | "role" | "planId" | "banned" | "theme" | "devTotpEnabled">;

/** Session → fresh user row (role/ban always read from DB, never trusted from the cookie). */
export async function userFromHeaders(h: Headers): Promise<CurrentUser | null> {
  const s = await auth.api.getSession({ headers: h }).catch(() => null);
  if (!s?.user?.id) return null;
  const row = await db.query.user.findFirst({
    where: eq(userTable.id, s.user.id),
    columns: { id: true, email: true, name: true, role: true, planId: true, banned: true, theme: true, devTotpEnabled: true },
  });
  if (!row || row.banned) return null;
  return row;
}

export const getCurrentUser = cache(async () => userFromHeaders(await headers()));

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}

/** Developer console gate: anyone else gets a plain not-found. */
export async function requireDeveloper(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== "developer") notFound();
  return u;
}
