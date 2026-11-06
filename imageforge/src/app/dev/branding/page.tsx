import { BrandingPanel } from "@/components/dev/branding-panel";
import { getConfigUncached } from "@/server/settings/store";

export default async function BrandingPage() {
  const cfg = await getConfigUncached();
  return <BrandingPanel branding={cfg.settings.branding} />;
}
