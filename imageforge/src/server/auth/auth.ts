import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings/store";

/**
 * Sign-ups in invite-only mode must come through /api/account/sign-up, which
 * validates the invite and runs Better Auth inside this context. Any user
 * creation outside it (direct POST to /api/auth/sign-up/email, magic link for
 * an unknown email) is refused while invite-only is on.
 */
export const inviteContext = new AsyncLocalStorage<{ inviteId: string; email: string | null }>();

const plugins: BetterAuthPlugin[] = [];
if (env.RESEND_API_KEY) {
  plugins.push(
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: email,
            subject: "Your sign-in link",
            html: `<p>Click to sign in. This link expires in 10 minutes.</p><p><a href="${url}">Sign in</a></p>`,
          }),
        });
        if (!res.ok) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not send email" });
      },
    }) as unknown as BetterAuthPlugin,
  );
}
plugins.push(nextCookies() as unknown as BetterAuthPlugin);

export const auth = betterAuth({
  appName: "IMAGEFORGE",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  advanced: { cookiePrefix: "imageforge" },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/magic-link") {
        const settings = await getSettings();
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : "";
        if (settings.access.inviteOnly) {
          const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
          if (!existing) throw new APIError("FORBIDDEN", { message: "IMAGEFORGE is invite-only right now." });
        }
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const settings = await getSettings();
          if (settings.access.inviteOnly && !inviteContext.getStore()) {
            throw new APIError("FORBIDDEN", { message: "IMAGEFORGE is invite-only right now. Ask for an invite link." });
          }
        },
      },
    },
    session: {
      create: {
        before: async (s) => {
          const u = await db.query.user.findFirst({ where: eq(schema.user.id, s.userId) });
          if (u?.banned) throw new APIError("FORBIDDEN", { message: "This account is suspended." });
        },
      },
    },
  },
  plugins,
});

export const magicLinkEnabled = () => Boolean(env.RESEND_API_KEY);
