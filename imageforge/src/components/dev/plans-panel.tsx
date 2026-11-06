"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NumberInput, PageHeader, Row, Section } from "./form";
import { devMutate } from "./step-up";

type Plan = { id: string; name: string; dailyQuota: number; monthlyQuota: number; maxImagesPerRequest: number; stripePriceId: string | null; active: boolean };

export function PlansPanel({ plans, stripe }: { plans: Plan[]; stripe: boolean }) {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Plans & billing" description="Plan quotas cap regular users (the lower of role and plan wins). Billing is a stub in v1: without Stripe keys everyone stays on their assigned plan." />
      <Section title="Stripe">
        <Row label="STRIPE_SECRET_KEY" hint="Optional. Checkout and webhooks are not wired in v1.">
          <Badge tone={stripe ? "good" : "default"}>{stripe ? "set" : "not set · free tier quotas apply"}</Badge>
        </Row>
      </Section>
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [p, setP] = useState(plan);
  const dirty = JSON.stringify(p) !== JSON.stringify(plan);
  return (
    <Section title={`${plan.name} (${plan.id})`}>
      <Row label="Name">
        <Input className="w-48" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </Row>
      <Row label="Daily quota">
        <NumberInput value={p.dailyQuota} min={0} onChange={(n) => setP({ ...p, dailyQuota: n })} />
      </Row>
      <Row label="Monthly quota">
        <NumberInput value={p.monthlyQuota} min={0} onChange={(n) => setP({ ...p, monthlyQuota: n })} />
      </Row>
      <Row label="Max images per request">
        <NumberInput value={p.maxImagesPerRequest} min={1} max={4} onChange={(n) => setP({ ...p, maxImagesPerRequest: n })} />
      </Row>
      <Row label="Stripe price id">
        <Input className="w-56 font-mono" placeholder="price_…" value={p.stripePriceId ?? ""} onChange={(e) => setP({ ...p, stripePriceId: e.target.value || null })} />
      </Row>
      <Row label="Active">
        <Switch checked={p.active} onCheckedChange={(v) => setP({ ...p, active: v })} />
      </Row>
      <div className="flex justify-end px-5 py-3">
        <Button size="sm" disabled={!dirty} onClick={async () => (await devMutate("/api/dev/plans", { method: "PUT", json: p }, "Plan saved")) && router.refresh()}>
          Save plan
        </Button>
      </div>
    </Section>
  );
}
