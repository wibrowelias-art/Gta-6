import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireApiUser } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema";
import { handler, ok, readJson } from "@/server/http";
import { getUsage } from "@/server/quota";
import { getSettings } from "@/server/settings/store";

export const GET = handler(async (req: Request) => {
  const { user } = await requireApiUser(req);
  const usage = await getUsage(user, await getSettings());
  return ok({ name: user.name, email: user.email, theme: user.theme, usage: { remaining: usage.remaining, limits: usage.limits, used: usage.used } });
});

const patch = z.object({ name: z.string().trim().min(1).max(60).optional(), theme: z.enum(["dark", "light"]).optional() });

export const PATCH = handler(async (req: Request) => {
  const { user } = await requireApiUser(req);
  const body = patch.parse(await readJson(req));
  if (Object.keys(body).length) await db.update(userTable).set({ ...body, updatedAt: new Date() }).where(eq(userTable.id, user.id));
  if (body.theme) (await cookies()).set("imageforge.theme", body.theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return ok({ ok: true });
});
