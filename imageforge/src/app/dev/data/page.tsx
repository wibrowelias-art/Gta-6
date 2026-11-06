import { DataPanel } from "@/components/dev/data-panel";
import { listSettingsVersions } from "@/server/settings/store";

export default async function DataPage() {
  const versions = await listSettingsVersions(30);
  return <DataPanel versions={versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))} />;
}
