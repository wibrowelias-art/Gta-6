import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { magicLinkEnabled } from "@/server/auth/auth";
import { getCurrentUser } from "@/server/auth/session";
import { ensureBootstrap } from "@/server/bootstrap";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    await ensureBootstrap().catch((e) => console.error("[bootstrap]", e instanceof Error ? e.message : e));
  }
  const u = await getCurrentUser();
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/create";
  if (u) redirect(safeNext);
  return <SignInForm magicLink={magicLinkEnabled()} next={safeNext} />;
}
