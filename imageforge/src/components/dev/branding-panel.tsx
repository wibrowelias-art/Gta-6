"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppSettings } from "@/server/settings/schema";
import { PageHeader, Row, SaveBar, Section, useSection } from "./form";

export function BrandingPanel({ branding }: { branding: AppSettings["branding"] }) {
  const s = useSection("branding", branding);
  const b = s.value;
  const set = (patch: Partial<AppSettings["branding"]>) => s.setValue({ ...b, ...patch });
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Branding" description="Name, logo, accent and footer. Custom CSS is sanitized (no imports, URLs, or script) before it is injected." />
      <Section title="Identity">
        <Row label="App name" htmlFor="appName">
          <Input id="appName" className="w-64" maxLength={40} value={b.appName} onChange={(e) => set({ appName: e.target.value })} />
        </Row>
        <Row label="Logo URL" hint="Square image, https." htmlFor="logo">
          <Input id="logo" className="w-80" placeholder="https://…" value={b.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} />
        </Row>
        <Row label="Accent color" htmlFor="accent">
          <div className="flex items-center gap-2">
            <input type="color" value={b.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent" aria-label="Accent color picker" />
            <Input id="accent" className="w-28 font-mono" value={b.accentColor} onChange={(e) => set({ accentColor: e.target.value })} />
          </div>
        </Row>
        <Row label="Support email" htmlFor="support">
          <Input id="support" className="w-64" type="email" value={b.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        </Row>
      </Section>
      <Section title="Footer links">
        {b.footerLinks.map((l, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-2.5">
            <Input className="w-40" placeholder="Label" value={l.label} onChange={(e) => set({ footerLinks: b.footerLinks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input className="flex-1" placeholder="https://…" value={l.url} onChange={(e) => set({ footerLinks: b.footerLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <Button size="icon" variant="ghost" aria-label="Remove link" onClick={() => set({ footerLinks: b.footerLinks.filter((_, j) => j !== i) })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="px-5 py-3">
          <Button size="sm" variant="secondary" disabled={b.footerLinks.length >= 10} onClick={() => set({ footerLinks: [...b.footerLinks, { label: "", url: "" }] })}>
            <Plus className="h-4 w-4" /> Add link
          </Button>
        </div>
      </Section>
      <Section title="Custom CSS" description="Up to 5,000 characters. Applied site-wide.">
        <div className="p-4">
          <textarea
            value={b.customCss}
            onChange={(e) => set({ customCss: e.target.value })}
            rows={8}
            maxLength={5000}
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder=".hero h1 { letter-spacing: -0.04em; }"
          />
        </div>
      </Section>
      <Section title="Preview">
        <div className="flex items-center gap-3 p-5">
          {b.logoUrl ? <img src={b.logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-md text-white" style={{ background: b.accentColor }}>◆</span>}
          <span className="font-semibold">{b.appName || "—"}</span>
          <span className="ml-auto rounded-lg px-3 py-1.5 text-sm text-white" style={{ background: b.accentColor }}>
            Generate
          </span>
        </div>
      </Section>
      <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} onReset={s.reset} />
    </div>
  );
}
