"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NumberInput, PageHeader, Section } from "./form";
import { devMutate } from "./step-up";

type Preset = {
  id?: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  promptPrefix: string;
  promptSuffix: string;
  negativeDefault: string;
  sortOrder: number;
  enabled: boolean;
};
const blank: Preset = { slug: "", name: "", thumbnailUrl: "", promptPrefix: "", promptSuffix: "", negativeDefault: "", sortOrder: 0, enabled: true };

export function PresetsPanel({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Preset | null>(null);
  const save = async (p: Preset) => {
    const res = await devMutate("/api/dev/presets", { method: "POST", json: { ...p, thumbnailUrl: p.thumbnailUrl || null } }, p.id ? "Preset updated" : "Preset created");
    if (res) {
      setEditing(null);
      router.refresh();
    }
  };
  return (
    <div className="max-w-4xl">
      <PageHeader title="Style presets" description="Users pick a style; its hidden prefix/suffix are added server-side and never sent to the browser. Policy runs on the combined prompt.">
        <Button size="sm" onClick={() => setEditing({ ...blank })} data-testid="new-preset">
          <Plus className="h-4 w-4" /> New preset
        </Button>
      </PageHeader>
      <Section title={`${presets.length} presets`}>
        {presets.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No presets yet. Create one to show style chips in the create view.</p>}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3">
            {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent/50 to-fg/10" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {p.name} <span className="font-mono text-xs text-muted">/{p.slug}</span>
              </p>
              <p className="truncate font-mono text-[11px] text-muted">
                {[p.promptPrefix, "{prompt}", p.promptSuffix].filter(Boolean).join(", ")}
              </p>
            </div>
            {!p.enabled && <Badge>disabled</Badge>}
            <Switch checked={p.enabled} aria-label="Enabled" onCheckedChange={(v) => save({ ...p, enabled: v })} />
            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(p)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={async () => (await devMutate("/api/dev/presets", { method: "DELETE", json: { id: p.id } }, "Preset deleted")) && router.refresh()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </Section>
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[min(92vw,560px)]">{editing && <PresetForm initial={editing} onSave={save} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function PresetForm({ initial, onSave }: { initial: Preset; onSave: (p: Preset) => void }) {
  const [p, setP] = useState(initial);
  const set = (patch: Partial<Preset>) => setP({ ...p, ...patch });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(p);
      }}
    >
      <DialogTitle>{initial.id ? "Edit preset" : "New preset"}</DialogTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="pname">Name</Label>
          <Input id="pname" required maxLength={40} value={p.name} onChange={(e) => set({ name: e.target.value, slug: initial.id ? p.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pslug">Slug</Label>
          <Input id="pslug" required pattern="[a-z0-9-]{1,60}" value={p.slug} onChange={(e) => set({ slug: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pthumb">Thumbnail URL</Label>
        <Input id="pthumb" placeholder="https://…" value={p.thumbnailUrl ?? ""} onChange={(e) => set({ thumbnailUrl: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pprefix">Hidden prefix</Label>
        <Textarea id="pprefix" rows={2} maxLength={500} placeholder="cinematic film still, anamorphic lens" value={p.promptPrefix} onChange={(e) => set({ promptPrefix: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="psuffix">Hidden suffix</Label>
        <Textarea id="psuffix" rows={2} maxLength={500} placeholder="soft volumetric light, 35mm grain" value={p.promptSuffix} onChange={(e) => set({ promptSuffix: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pneg">Default negative prompt</Label>
        <Input id="pneg" maxLength={500} value={p.negativeDefault} onChange={(e) => set({ negativeDefault: e.target.value })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          Sort <NumberInput value={p.sortOrder} min={0} max={1000} onChange={(n) => set({ sortOrder: n })} className="w-20" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Enabled <Switch checked={p.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </label>
      </div>
      <Button type="submit" className="w-full">
        Save preset
      </Button>
    </form>
  );
}
