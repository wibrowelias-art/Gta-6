"use client";
import { FlaskConical, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "./form";
import { devApi } from "./step-up";

type Decision = { action: "allow" | "warn" | "block"; hard: boolean; reasons: { category: string; action: string; matched?: string; ruleId?: string; hard?: boolean }[] };
type Result = {
  version: number;
  finalPrompt: string;
  decision: Decision;
  breakGlassDecision: Decision;
  outcome?: { status: string; message?: string; images?: { id: string; url: string }[] };
};

export function DryRunPanel({ breakGlassEnabled, presets }: { breakGlassEnabled: boolean; presets: { slug: string; name: string }[] }) {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [preset, setPreset] = useState("");
  const [breakGlass, setBreakGlass] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(generate: boolean) {
    setBusy(true);
    try {
      setResult(await devApi<Result>("/api/dev/dry-run", { method: "POST", json: { prompt, negativePrompt: negative || null, preset: preset || null, generate, breakGlass } }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Dry-run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Policy dry-run" description="See exactly how the live policy treats a prompt. Evaluate stores nothing and calls no model." />
      <Card className="space-y-3 p-5">
        <div className="space-y-1">
          <Label htmlFor="dr-prompt">Prompt</Label>
          <Textarea id="dr-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} data-testid="dry-run-prompt" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dr-neg">Negative prompt</Label>
            <Input id="dr-neg" value={negative} onChange={(e) => setNegative(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dr-preset">Preset</Label>
            <Select id="dr-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="">None</option>
              {presets.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={() => run(false)} disabled={!prompt.trim() || busy} data-testid="dry-run-evaluate">
            <FlaskConical className="h-4 w-4" /> Evaluate
          </Button>
          <Button variant="secondary" onClick={() => run(true)} disabled={!prompt.trim() || busy}>
            Generate 1 test image
          </Button>
          <label className={`ml-auto flex items-center gap-2 text-sm ${breakGlassEnabled ? "" : "opacity-50"}`}>
            Break glass
            <Switch checked={breakGlass} disabled={!breakGlassEnabled} onCheckedChange={setBreakGlass} />
          </label>
        </div>
        {!breakGlassEnabled && <p className="text-xs text-muted">Break glass is off. Enable it in Access & flags to test generation past configurable rules.</p>}
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3 w-3" /> Child safety is enforced in every mode.
        </p>
      </Card>

      {result && (
        <div className="mt-4 space-y-3" data-testid="dry-run-result">
          <DecisionCard title={`Live policy · v${result.version}`} d={result.decision} />
          <DecisionCard title="With break glass" d={result.breakGlassDecision} />
          <Card className="p-4">
            <p className="text-xs text-muted">Final prompt sent to the model</p>
            <p className="mt-1 font-mono text-xs">{result.finalPrompt}</p>
          </Card>
          {result.outcome && (
            <Card className="p-4">
              <p className="text-sm">
                Outcome: <Badge tone={result.outcome.status === "succeeded" ? "good" : "bad"}>{result.outcome.status}</Badge> {result.outcome.message}
              </p>
              {result.outcome.images?.map((i) => <img key={i.id} src={i.url} alt="" className="mt-3 max-h-64 rounded-lg" />)}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ title, d }: { title: string; d: Decision }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone={d.action === "allow" ? "good" : d.action === "warn" ? "warn" : "bad"} data-testid="dry-run-action">
          {d.action}
        </Badge>
        {d.hard && <Badge tone="bad">child-safety hard block</Badge>}
      </div>
      {d.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {d.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <Badge tone={r.action === "block" ? "bad" : "warn"}>{r.action}</Badge>
              <span>{r.category}</span>
              {r.matched && <code className="text-muted">“{r.matched}”</code>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
