import { ProvidersPanel } from "@/components/dev/providers-panel";
import { providerStatus } from "@/server/providers/registry";
import { getConfigUncached } from "@/server/settings/store";

export default async function ProvidersPage() {
  const cfg = await getConfigUncached();
  return <ProvidersPanel providers={cfg.settings.providers} status={providerStatus(cfg.settings)} />;
}
