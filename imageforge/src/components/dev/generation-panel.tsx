"use client";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ALL_ASPECT_RATIOS } from "@/lib/constants";
import type { AppSettings } from "@/server/settings/schema";
import { ListInput, NumberInput, PageHeader, Row, SaveBar, Section, useSection } from "./form";

export function GenerationPanel({ generation, quotas }: { generation: AppSettings["generation"]; quotas: AppSettings["quotas"] }) {
  const g = useSection("generation", generation);
  const q = useSection("quotas", quotas);
  const v = g.value;
  const set = (patch: Partial<AppSettings["generation"]>) => g.setValue({ ...v, ...patch });
  const roles = ["user", "moderator", "developer"] as const;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Generation & quotas" description="Model choice, request limits, watermark and retention. Quotas count images, not requests." />
      <Section title="Models">
        <Row label="Default model" htmlFor="defaultModel">
          <Select id="defaultModel" className="w-72" value={v.defaultModel} onChange={(e) => set({ defaultModel: e.target.value })}>
            {v.allowedModels.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Row>
        <Row label="Allowed models" hint="provider:model — one per line. Unconfigured providers are skipped automatically.">
          <ListInput value={v.allowedModels} onChange={(m) => set({ allowedModels: m })} rows={4} />
        </Row>
      </Section>

      <Section title="Limits">
        <Row label="Max images per request" htmlFor="maxImg">
          <NumberInput id="maxImg" value={v.maxImagesPerRequest} min={1} max={4} onChange={(n) => set({ maxImagesPerRequest: n })} />
        </Row>
        <Row label="Max prompt length" htmlFor="maxLen">
          <NumberInput id="maxLen" value={v.maxPromptLength} min={20} max={4000} onChange={(n) => set({ maxPromptLength: n })} />
        </Row>
        <Row label="Max concurrent jobs per user" htmlFor="conc">
          <NumberInput id="conc" value={v.maxConcurrentJobsPerUser} min={1} max={20} onChange={(n) => set({ maxConcurrentJobsPerUser: n })} />
        </Row>
        <Row label="Provider timeout (ms)" htmlFor="timeout">
          <NumberInput id="timeout" value={v.providerTimeoutMs} min={5000} max={120000} step={1000} onChange={(n) => set({ providerTimeoutMs: n })} />
        </Row>
        <Row label="Aspect ratios">
          <div className="flex flex-wrap gap-1.5">
            {ALL_ASPECT_RATIOS.map((r) => {
              const on = v.aspectRatios.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ aspectRatios: on ? v.aspectRatios.filter((x) => x !== r) : [...v.aspectRatios, r] })}
                  className={`rounded-md border px-2 py-1 font-mono text-xs ${on ? "border-accent bg-accent/10 text-fg" : "border-border text-muted"}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section title="Quotas per role" description="Users are also capped by their plan (Plans & billing); the lower limit wins.">
        {roles.map((r) => (
          <Row key={r} label={r[0]!.toUpperCase() + r.slice(1)}>
            <div className="flex items-center gap-2 text-xs text-muted">
              Daily
              <NumberInput
                id={`quota-${r}-daily`}
                value={q.value.byRole[r].daily}
                min={0}
                onChange={(n) => q.setValue({ byRole: { ...q.value.byRole, [r]: { ...q.value.byRole[r], daily: n } } })}
              />
              Monthly
              <NumberInput
                id={`quota-${r}-monthly`}
                value={q.value.byRole[r].monthly}
                min={0}
                onChange={(n) => q.setValue({ byRole: { ...q.value.byRole, [r]: { ...q.value.byRole[r], monthly: n } } })}
              />
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Watermark">
        <Row label="Watermark images">
          <Switch checked={v.watermark.enabled} onCheckedChange={(e) => set({ watermark: { ...v.watermark, enabled: e } })} aria-label="Watermark" />
        </Row>
        {v.watermark.enabled && (
          <>
            <Row label="Text" htmlFor="wmText">
              <Input id="wmText" className="w-56" maxLength={60} value={v.watermark.text} onChange={(e) => set({ watermark: { ...v.watermark, text: e.target.value } })} />
            </Row>
            <Row label={`Opacity · ${Math.round(v.watermark.opacity * 100)}%`}>
              <input type="range" min={0.05} max={1} step={0.05} value={v.watermark.opacity} onChange={(e) => set({ watermark: { ...v.watermark, opacity: Number(e.target.value) } })} className="w-56 accent-[var(--accent)]" />
            </Row>
            <Row label="Position">
              <Select className="w-40" value={v.watermark.position} onChange={(e) => set({ watermark: { ...v.watermark, position: e.target.value as AppSettings["generation"]["watermark"]["position"] } })}>
                <option value="br">Bottom right</option>
                <option value="bl">Bottom left</option>
                <option value="tr">Top right</option>
                <option value="tl">Top left</option>
                <option value="center">Center</option>
              </Select>
            </Row>
          </>
        )}
      </Section>

      <Section title="Retention">
        <Row label="Keep images for (days)" hint="0 keeps forever. A daily job deletes older images and their files." htmlFor="ret">
          <NumberInput id="ret" value={v.retentionDays} min={0} max={3650} onChange={(n) => set({ retentionDays: n })} />
        </Row>
      </Section>

      <SaveBar
        dirty={g.dirty || q.dirty}
        saving={g.saving || q.saving}
        onSave={async () => {
          if (g.dirty) await g.save();
          if (q.dirty) await q.save();
        }}
        onReset={() => {
          g.reset();
          q.reset();
        }}
      />
    </div>
  );
}
