"use client";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AppSettings, PolicyRuleInput } from "@/server/settings/schema";
import { ListInput, PageHeader, Row, SaveBar, Section, Segmented, useSection } from "./form";
import { devMutate } from "./step-up";

const CATS = ["violence", "weapons", "hate", "scams", "doxxing", "drugs"] as const;
const CAT_LABEL: Record<(typeof CATS)[number], string> = {
  violence: "Graphic violence",
  weapons: "Weapons",
  hate: "Hate & extremism",
  scams: "Scams & forged documents",
  doxxing: "Doxxing & private info",
  drugs: "Illegal drug manufacturing",
};

export function PolicyPanel({ policy, rules, version }: { policy: AppSettings["policy"]; rules: PolicyRuleInput[]; version: number }) {
  const s = useSection("policy", policy);
  const p = s.value;
  const set = (patch: Partial<AppSettings["policy"]>) => s.setValue({ ...p, ...patch });
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Content policy" description={`Runs on every request — create, remix, API and dry-run. Active settings version v${version}.`} />

      <Section title="Always on" description="Enforced in code before any provider call. Not configurable from the UI, API, settings import or break-glass.">
        <Row label="Child sexual content & sexualisation of minors" hint="Hard block. Refused, logged, never sent to a model.">
          <Badge tone="bad" className="gap-1">
            <Lock className="h-3 w-3" /> Always blocked
          </Badge>
        </Row>
      </Section>

      <Section title="Categories" description="Off allows, warn generates with a notice (and safe-rewrite if on), block refuses.">
        {CATS.map((c) => (
          <Row key={c} label={CAT_LABEL[c]}>
            <Segmented name={c} value={p.categories[c]} options={["off", "warn", "block"] as const} onChange={(v) => set({ categories: { ...p.categories, [c]: v } })} />
          </Row>
        ))}
        <Row label="Photorealistic faces of real people" hint="Known public figures and roles combined with photo-style terms.">
          <div className="flex items-center gap-3">
            {p.realFaces.enabled && <Segmented name="realFaces" value={p.realFaces.severity} options={["warn", "block"] as const} onChange={(v) => set({ realFaces: { ...p.realFaces, severity: v } })} />}
            <Switch checked={p.realFaces.enabled} onCheckedChange={(v) => set({ realFaces: { ...p.realFaces, enabled: v } })} aria-label="Real faces" />
          </div>
        </Row>
        <Row label="Brand & logo impersonation" hint="Brand names combined with logo / official / packaging terms.">
          <Switch checked={p.brandImpersonation} onCheckedChange={(v) => set({ brandImpersonation: v })} aria-label="Brand impersonation" />
        </Row>
      </Section>

      <Section title="Behaviour">
        <Row label="Refusal message" hint="Shown to users when a prompt is blocked." htmlFor="refusal">
          <Input id="refusal" className="w-96 max-w-full" value={p.refusalMessage} maxLength={500} onChange={(e) => set({ refusalMessage: e.target.value })} />
        </Row>
        <Row label="Safe rewrite" hint="For warned prompts: strip flagged terms and steer the model to non-graphic output.">
          <Switch checked={p.safeRewrite} onCheckedChange={(v) => set({ safeRewrite: v })} aria-label="Safe rewrite" />
        </Row>
        <Row label="Allowlist hard mode" hint="Only prompts that mention an allowed topic are generated.">
          <Switch checked={p.allowlistMode} onCheckedChange={(v) => set({ allowlistMode: v })} aria-label="Allowlist mode" />
        </Row>
        {p.allowlistMode && (
          <Row label="Allowed topics" hint="One per line or comma separated.">
            <ListInput value={p.allowedTopics} onChange={(v) => set({ allowedTopics: v })} placeholder={"landscape\narchitecture"} />
          </Row>
        )}
      </Section>

      <RulesEditor initial={rules} />
      <SaveBar dirty={s.dirty} saving={s.saving} onSave={s.save} onReset={s.reset} />
    </div>
  );
}

function RulesEditor({ initial }: { initial: PolicyRuleInput[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<PolicyRuleInput[]>(initial);
  const [draft, setDraft] = useState<PolicyRuleInput>({ kind: "keyword", pattern: "", category: "", action: "block", severity: 2, enabled: true });
  const [saving, setSaving] = useState(false);

  async function persist(next: PolicyRuleInput[], msg: string) {
    setSaving(true);
    const res = await devMutate<{ rules: PolicyRuleInput[] }>("/api/dev/rules", { method: "PUT", json: { rules: next.map(({ id: _id, ...r }) => ({ ...r, category: r.category || null })) } }, msg);
    setSaving(false);
    if (res) {
      setRules(res.rules);
      router.refresh();
    }
    return Boolean(res);
  }

  return (
    <Section title="Blocked topics" description="Your own keyword, regex and category rules. Matching ignores case, accents, leetspeak and spaced-out letters.">
      <form
        className="flex flex-wrap items-center gap-2 px-5 py-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.pattern.trim()) return;
          if (await persist([...rules, { ...draft, pattern: draft.pattern.trim() }], "Rule added · live within 15s")) setDraft({ ...draft, pattern: "", category: "" });
        }}
      >
        <Select aria-label="Rule type" className="w-32" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PolicyRuleInput["kind"] })}>
          <option value="keyword">Keyword</option>
          <option value="category">Word list</option>
          <option value="regex">Regex</option>
          <option value="allow">Allow topic</option>
        </Select>
        <Input
          aria-label="Pattern"
          data-testid="rule-pattern"
          className="min-w-48 flex-1"
          placeholder={draft.kind === "regex" ? "e.g. \\bfoo\\d+" : draft.kind === "category" ? "comma, separated, words" : "e.g. dragon"}
          value={draft.pattern}
          onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
        />
        <Input aria-label="Label" className="w-36" placeholder="label (optional)" value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        {draft.kind !== "allow" && (
          <Select aria-label="Action" className="w-24" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as "warn" | "block" })}>
            <option value="block">Block</option>
            <option value="warn">Warn</option>
          </Select>
        )}
        <Button type="submit" size="sm" disabled={saving} data-testid="add-rule">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
      {rules.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">No custom rules yet.</p>
      ) : (
        rules.map((r, i) => (
          <div key={r.id ?? i} className="flex items-center gap-3 px-5 py-2.5 text-sm" data-testid="rule-row">
            <Badge tone={r.kind === "allow" ? "good" : r.action === "warn" ? "warn" : "bad"}>{r.kind === "allow" ? "allow" : r.action}</Badge>
            <span className="w-20 text-xs text-muted">{r.kind}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{r.pattern}</code>
            {r.category && <span className="text-xs text-muted">{r.category}</span>}
            <Switch
              checked={r.enabled}
              aria-label="Rule enabled"
              onCheckedChange={(v) => persist(rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)), v ? "Rule enabled" : "Rule disabled")}
            />
            <Button size="icon" variant="ghost" aria-label="Delete rule" onClick={() => persist(rules.filter((_, j) => j !== i), "Rule removed")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </Section>
  );
}
