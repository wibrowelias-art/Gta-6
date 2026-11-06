import { SecurityPanel } from "@/components/dev/security-panel";
import { requireDeveloper } from "@/server/auth/session";
import { availableStepUpMethods } from "@/server/auth/step-up";
import { env } from "@/server/env";

export default async function SecurityPage() {
  const me = await requireDeveloper();
  return <SecurityPanel totpEnabled={me.devTotpEnabled} pinSet={Boolean(env.DEV_PIN)} methods={await availableStepUpMethods(me.id)} />;
}
