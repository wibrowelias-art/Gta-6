import { PolicyPanel } from "@/components/dev/policy-panel";
import { getConfigUncached, ruleRowToInput } from "@/server/settings/store";

export default async function PolicyPage() {
  const cfg = await getConfigUncached();
  return <PolicyPanel policy={cfg.settings.policy} rules={cfg.rules.map(ruleRowToInput)} version={cfg.version} />;
}
