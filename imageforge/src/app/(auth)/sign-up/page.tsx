import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings/store";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  if (await getCurrentUser()) redirect("/create");
  const [{ invite }, settings] = await Promise.all([searchParams, getSettings()]);
  return <SignUpForm invite={invite ?? ""} inviteOnly={settings.access.inviteOnly} />;
}
