import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import * as OTPAuth from "otpauth";
import { db } from "@/server/db/client";
import { account, user as userTable } from "@/server/db/schema";
import { env } from "@/server/env";
import { verifyPassword } from "better-auth/crypto";
import { decrypt, encrypt, hmac, safeEqual } from "./crypto";

/** /dev step-up: TOTP or DEV_PIN unlocks sensitive developer actions for 10 minutes. */
export const STEP_UP_TTL_MS = 10 * 60 * 1000;
const COOKIE = "imageforge.stepup";

function sign(userId: string, exp: number) {
  return `${exp}.${hmac("step-up", `${userId}.${exp}`)}`;
}

export async function hasStepUp(userId: string): Promise<boolean> {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return false;
  const [expStr] = c.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(c, sign(userId, exp));
}

export async function stepUpExpiresAt(userId: string): Promise<number | null> {
  if (!(await hasStepUp(userId))) return null;
  const c = (await cookies()).get(COOKIE)?.value ?? "";
  return Number(c.split(".")[0]);
}

export async function grantStepUp(userId: string) {
  const exp = Date.now() + STEP_UP_TTL_MS;
  (await cookies()).set(COOKIE, sign(userId, exp), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STEP_UP_TTL_MS / 1000,
  });
  return exp;
}

export async function clearStepUp() {
  (await cookies()).delete(COOKIE);
}

export type StepUpMethod = "pin" | "totp" | "password";

/** Which methods this developer may use right now. Password is only a last resort when neither PIN nor TOTP exists. */
export async function availableStepUpMethods(userId: string): Promise<StepUpMethod[]> {
  const u = await db.query.user.findFirst({ where: eq(userTable.id, userId), columns: { devTotpEnabled: true } });
  const m: StepUpMethod[] = [];
  if (u?.devTotpEnabled) m.push("totp");
  if (env.DEV_PIN) m.push("pin");
  if (m.length === 0) m.push("password");
  return m;
}

export async function verifyStepUp(userId: string, method: StepUpMethod, code: string): Promise<boolean> {
  const methods = await availableStepUpMethods(userId);
  if (!methods.includes(method)) return false;
  if (method === "pin") return Boolean(env.DEV_PIN) && safeEqual(code.trim(), env.DEV_PIN!);
  if (method === "totp") {
    const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
    if (!u?.devTotpSecret || !u.devTotpEnabled) return false;
    return verifyTotp(decrypt("totp", u.devTotpSecret), code);
  }
  const acc = await db.query.account.findFirst({ where: eq(account.userId, userId) });
  if (!acc?.password) return false;
  return verifyPassword({ hash: acc.password, password: code });
}

export function makeTotp(secretBase32: string, label = "developer") {
  return new OTPAuth.TOTP({ issuer: "IMAGEFORGE", label, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretBase32) });
}

export function verifyTotp(secretBase32: string, code: string) {
  const delta = makeTotp(secretBase32).validate({ token: code.replace(/\s/g, ""), window: 1 });
  return delta !== null;
}

export async function beginTotpEnrollment(userId: string, email: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await db.update(userTable).set({ devTotpSecret: encrypt("totp", secret), devTotpEnabled: false }).where(eq(userTable.id, userId));
  return { secret, uri: makeTotp(secret, email).toString() };
}

export async function confirmTotpEnrollment(userId: string, code: string) {
  const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) });
  if (!u?.devTotpSecret) return false;
  if (!verifyTotp(decrypt("totp", u.devTotpSecret), code)) return false;
  await db.update(userTable).set({ devTotpEnabled: true }).where(eq(userTable.id, userId));
  return true;
}
