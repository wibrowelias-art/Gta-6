import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { invites } from "@/server/db/schema";
import { randomToken, sha256 } from "@/server/auth/crypto";
import type { Role } from "@/server/db/schema";

export async function createInvite(opts: { email?: string | null; role: Role; createdBy: string; days?: number }) {
  const token = randomToken(24);
  const [row] = await db
    .insert(invites)
    .values({
      email: opts.email?.toLowerCase() || null,
      role: opts.role,
      tokenHash: sha256(token),
      createdBy: opts.createdBy,
      expiresAt: new Date(Date.now() + (opts.days ?? 7) * 86400_000),
    })
    .returning();
  return { invite: row!, token };
}

export async function findValidInvite(token: string, email: string) {
  const row = await db.query.invites.findFirst({
    where: and(eq(invites.tokenHash, sha256(token)), isNull(invites.usedAt), gt(invites.expiresAt, new Date())),
  });
  if (!row) return null;
  if (row.email && row.email !== email.toLowerCase()) return null;
  return row;
}
