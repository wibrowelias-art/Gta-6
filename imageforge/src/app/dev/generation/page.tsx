import { GenerationPanel } from "@/components/dev/generation-panel";
import { getConfigUncached } from "@/server/settings/store";

export default async function GenerationPage() {
  const cfg = await getConfigUncached();
  return <GenerationPanel generation={cfg.settings.generation} quotas={cfg.settings.quotas} />;
}
