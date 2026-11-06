"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AppSettings, ProviderId } from "@/server/settings/schema";
import { NumberInput, PageHeader, Row, SaveBar, Section, useSection } from "./form";

type Status = { id: ProviderId; label: string; knownModels: string[]; configured: boolean; key: { set: boolean; hint: string | null } };

export function ProvidersPanel({ providers, status }: { providers: AppSettings["providers"]; status: Status[] }) {
  const s = useSection("providers", providers);
  const v = s.value;
  const set = (patch: Partial<AppSettings["providers"]>) => s.setValue({ ...v, ...patch });
  const ordered = [...v.order, ...status.map((x) => x.id).filter((id) => !v.order.includes(id))];
  const move = (i: number, dir: -1 | 1) => {
    const next = [...ordered];
    const [x] = next.splice(i, 1);
    next.splice(i + dir, 0, x!);
    set({ order: next });
  };
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Providers" description="Keys live only in server environment variables. On failure a request retries once on the next provider in order." />
      <Section title="Fallback order & status">
        {ordered.map((id, i) => {
          const st = status.find((x) => x.id === id)!;
          return (
            <div key={id} className="flex flex-wrap items-center gap-3 px-5 py-3.5" data-testid={`provider-${id}`}>
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" className="h-5 w-6" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-6" aria-label="Move down" disabled={i === ordered.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <span className="w-5 font-mono text-xs text-muted">{i + 1}</span>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">{st.label}</p>
                <p className="font-mono text-[11px] text-muted">{st.knownModels.join(" · ")}</p>
              </div>
              <Badge tone={st.key.set ? "good" : "warn"}>{st.key.set ? `key ${st.key.hint}` : "key missing"}</Badge>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                $/img
                <NumberInput value={v.costPerImageUsd[id]} step={0.005} min={0} max={10} className="w-20" onChange={(n) => set({ costPerImageUsd: { ...v.costPerImageUsd, [id]: n } })} />
              </div>
              <Switch checked={v.enabled[id]} aria-label={`Enable ${id}`} onCheckedChange={(x) => set({ enabled: { ...v.enabled, [id]: x } })} />
            </div>
          );
        })}
      </Section>
      <Section title="Environment variables">
        <Row label="OPENAI_API_KEY" hint="Used by OpenAI Images (gpt-image-1).">
          <Badge tone={status.find((x) => x.id === "openai")?.key.set ? "good" : "warn"}>{status.find((x) => x.id === "openai")?.key.set ? "set" : "missing"}</Badge>
        </Row>
        <Row label="GEMINI_API_KEY" hint="Used by Imagen / Gemini image models.">
          <Badge tone={status.find((x) => x.id === "gemini")?.key.set ? "good" : "warn"}>{status.find((x) => x.id === "gemini")?.key.set ? "set" : "missing"}</Badge>
        </Row>
      </Section>
      <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} onReset={s.reset} />
    </div>
  );
}
