import "server-only";

/**
 * Server-only environment access. This module is marked `server-only`, so any
 * import from a client component fails the build. Never re-export values from
 * here into props passed to client components.
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get DATABASE_URL() {
    const v = read("DATABASE_URL");
    if (!v) throw new Error("DATABASE_URL is not set");
    return v;
  },
  get BETTER_AUTH_SECRET() {
    const v = read("BETTER_AUTH_SECRET");
    if (!v) {
      if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
        throw new Error("BETTER_AUTH_SECRET is not set");
      }
      return "insecure-dev-secret-do-not-use-in-production";
    }
    return v;
  },
  get APP_URL() {
    return read("NEXT_PUBLIC_APP_URL") ?? read("BETTER_AUTH_URL") ?? "http://localhost:3000";
  },
  get DEV_BOOTSTRAP_EMAIL() {
    return read("DEV_BOOTSTRAP_EMAIL");
  },
  get DEV_BOOTSTRAP_PASSWORD() {
    return read("DEV_BOOTSTRAP_PASSWORD");
  },
  get DEV_PIN() {
    return read("DEV_PIN");
  },
  get OPENAI_API_KEY() {
    return read("OPENAI_API_KEY");
  },
  get GEMINI_API_KEY() {
    return read("GEMINI_API_KEY");
  },
  get BLOB_READ_WRITE_TOKEN() {
    return read("BLOB_READ_WRITE_TOKEN");
  },
  get RESEND_API_KEY() {
    return read("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return read("EMAIL_FROM") ?? "IMAGEFORGE <onboarding@resend.dev>";
  },
  get CRON_SECRET() {
    return read("CRON_SECRET");
  },
  get STRIPE_SECRET_KEY() {
    return read("STRIPE_SECRET_KEY");
  },
};

/** Masked status for the developer console. Never returns more than the last 4 chars. */
export function keyStatus(value: string | undefined): { set: boolean; hint: string | null } {
  if (!value) return { set: false, hint: null };
  return { set: true, hint: value.length > 8 ? `••••${value.slice(-4)}` : "••••" };
}
