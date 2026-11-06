import { ProfileSettings } from "@/components/app/profile-settings";
import { requireUser } from "@/server/auth/session";
import { getUsage } from "@/server/quota";
import { getSettings } from "@/server/settings/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const usage = await getUsage(user, await getSettings());
  return <ProfileSettings name={user.name} email={user.email} theme={user.theme === "light" ? "light" : "dark"} usage={usage} />;
}
