"use client";
import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/server/settings/schema";
import { ListInput, NumberInput, PageHeader, Row, SaveBar, Section, useSection } from "./form";
import { devMutate } from "./step-up";

type Invite = { id: string; email: string | null; role: string; expiresAt: string; usedAt: string | null };
const FLAG_LABELS: Record<keyof AppSettings["access"]["flags"], [string, string]> = {
  publicShare: ["Public share links", "Users can make a single image viewable by link."],
  remix: ["Remix", "Reuse a previous prompt and settings."],
  negativePrompt: ["Negative prompt", "Show the “avoid” field in the create view."],
  apiAccess: ["API access", "Enables /api/v1/generate for allowed origins."],
  img2img: ["Image-to-image", "Reserved for providers that support a reference image."],
};

export function AccessPanel({ access, devTools, invites }: { access: AppSettings["access"]; devTools: AppSettings["devTools"]; invites: Invite[] }) {
  const a = useSection("access", access);
  const d = useSection("devTools", devTools);
  const v = a.value;
  const set = (patch: Partial<AppSettings["access"]>) => a.setValue({ ...v, ...patch });
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Access & flags" description="Who can sign up, maintenance, feature flags and rate limits." />
      <Section title="Sign-up & availability">
        <Row label="Invite-only" hint="New accounts need an invite link. Existing users can still sign in.">
          <Switch checked={v.inviteOnly} onCheckedChange={(x) => set({ inviteOnly: x })} aria-label="Invite-only" data-testid="invite-only" />
        </Row>
        <Row label="Maintenance mode" hint="Users see the message and can’t generate. Developers are exempt.">
          <Switch checked={v.maintenance.enabled} onCheckedChange={(x) => set({ maintenance: { ...v.maintenance, enabled: x } })} aria-label="Maintenance" />
        </Row>
        {v.maintenance.enabled && (
          <Row label="Maintenance message" htmlFor="mmsg">
            <Input id="mmsg" className="w-96 max-w-full" value={v.maintenance.message} onChange={(e) => set({ maintenance: { ...v.maintenance, message: e.target.value } })} />
          </Row>
        )}
      </Section>

      <Section title="Feature flags">
        {(Object.keys(FLAG_LABELS) as (keyof typeof FLAG_LABELS)[]).map((k) => (
          <Row key={k} label={FLAG_LABELS[k][0]} hint={FLAG_LABELS[k][1]}>
            <Switch checked={v.flags[k]} onCheckedChange={(x) => set({ flags: { ...v.flags, [k]: x } })} aria-label={FLAG_LABELS[k][0]} />
          </Row>
        ))}
      </Section>

      <Section title="Rate limits & origins">
        <Row label="Requests per IP per minute" htmlFor="rlip">
          <NumberInput id="rlip" value={v.rateLimits.perIpPerMin} min={1} onChange={(n) => set({ rateLimits: { ...v.rateLimits, perIpPerMin: n } })} />
        </Row>
        <Row label="Requests per user per minute" htmlFor="rlu">
          <NumberInput id="rlu" value={v.rateLimits.perUserPerMin} min={1} onChange={(n) => set({ rateLimits: { ...v.rateLimits, perUserPerMin: n } })} />
        </Row>
        <Row label="Allowed origins (public API)" hint="Full origins, e.g. https://app.example.com">
          <ListInput value={v.allowedOrigins} onChange={(x) => set({ allowedOrigins: x })} />
        </Row>
      </Section>

      <Section title="Developer tools">
        <Row label="Break glass" hint="Lets the Policy dry-run tool generate while bypassing configurable rules. Child safety is still enforced.">
          <Switch checked={d.value.breakGlass} onCheckedChange={(x) => d.setValue({ breakGlass: x })} aria-label="Break glass" />
        </Row>
      </Section>

      <Invites initial={invites} />

      <SaveBar
        dirty={a.dirty || d.dirty}
        saving={a.saving || d.saving}
        onSave={async () => {
          if (a.dirty) await a.save();
          if (d.dirty) await d.save();
        }}
        onReset={() => {
          a.reset();
          d.reset();
        }}
      />
    </div>
  );
}

function Invites({ initial }: { initial: Invite[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<string | null>(null);
  return (
    <Section title="Invites" description="Links are shown once. Store them somewhere safe.">
      <form
        className="flex flex-wrap items-center gap-2 px-5 py-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await devMutate<{ url: string }>("/api/dev/invites", { method: "POST", json: { email, role, days } }, "Invite created");
          if (res) {
            setLink(res.url);
            setEmail("");
            router.refresh();
          }
        }}
      >
        <Input className="min-w-48 flex-1" type="email" placeholder="email (optional — any email if blank)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Select className="w-32" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="developer">Developer</option>
        </Select>
        <span className="text-xs text-muted">days</span>
        <NumberInput value={days} min={1} max={90} onChange={setDays} className="w-16" />
        <Button size="sm" type="submit">
          Create link
        </Button>
      </form>
      {link && (
        <div className="flex items-center gap-2 px-5 py-3">
          <code className="min-w-0 flex-1 truncate rounded-md bg-fg/5 px-2 py-1 font-mono text-xs" data-testid="invite-link">
            {link}
          </code>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Copied");
            }}
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
      )}
      {initial.map((i) => (
        <div key={i.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate">{i.email ?? "Any email"}</span>
          <Badge>{i.role}</Badge>
          {i.usedAt ? <Badge tone="good">used</Badge> : new Date(i.expiresAt) < new Date() ? <Badge tone="warn">expired</Badge> : <Badge tone="accent">open</Badge>}
          <Button size="icon" variant="ghost" aria-label="Revoke invite" onClick={async () => (await devMutate("/api/dev/invites", { method: "DELETE", json: { id: i.id } }, "Invite revoked")) && router.refresh()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </Section>
  );
}
