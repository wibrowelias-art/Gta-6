"use client";
import { Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { PageHeader, Row, Section } from "./form";
import { devMutate, downloadDev } from "./step-up";

export function DataPanel({ versions }: { versions: { version: number; isActive: boolean; createdAt: string; note: string | null }[] }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Import / export" description="Settings exports include policy rules. Imports are validated strictly and create a new version — nothing is overwritten." />
      <Section title="Data">
        <Row label="Export settings JSON">
          <Button size="sm" variant="secondary" onClick={() => downloadDev("/api/dev/settings/export", "imageforge-settings.json")}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </Row>
        <Row label="Import settings JSON" hint="Unknown fields are rejected.">
          <>
            <input
              ref={file}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                let json: unknown;
                try {
                  json = JSON.parse(await f.text());
                } catch {
                  toast.error("That file isn’t valid JSON.");
                  return;
                }
                if (await devMutate("/api/dev/settings/import", { method: "POST", json }, "Imported as a new version")) router.refresh();
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => file.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </>
        </Row>
        <Row label="Export users CSV">
          <Button size="sm" variant="secondary" onClick={() => downloadDev("/api/dev/users/export", "imageforge-users.csv")}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </Row>
        <Row label="Run retention now" hint="Deletes images past the retention window and their files.">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const r = await devMutate<{ deleted: number }>("/api/dev/retention", { method: "POST" }, "Retention complete");
              if (r) toast.message(`${r.deleted} images deleted`);
            }}
          >
            Run
          </Button>
        </Row>
      </Section>
      <Section title="Settings versions">
        {versions.map((v) => (
          <div key={v.version} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="w-12 font-mono text-xs">v{v.version}</span>
            {v.isActive && <Badge tone="good">active</Badge>}
            <span className="flex-1 truncate text-muted">{v.note ?? "—"}</span>
            <span className="text-xs text-muted">{formatDate(v.createdAt)}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
