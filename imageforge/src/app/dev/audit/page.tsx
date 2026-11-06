import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dev/form";
import { formatDate } from "@/lib/utils";
import { searchAudit } from "@/server/audit";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; page?: string }> }) {
  const { q, action, page } = await searchParams;
  const p = Math.max(0, Number(page ?? 0) || 0);
  const rows = await searchAudit({ text: q || undefined, action: action || undefined, limit: 50, offset: p * 50 });
  const qs = (n: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), ...(action ? { action } : {}), page: String(n) })}`;
  return (
    <div className="max-w-5xl">
      <PageHeader title="Audit log" description="Every developer action and security event: who, what, when, IP, and before/after JSON." />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <Input name="q" defaultValue={q} placeholder="Search actor, action, target, IP or JSON…" className="min-w-64 flex-1" />
        <Input name="action" defaultValue={action} placeholder="exact action, e.g. settings.update" className="w-64" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No entries match.</p>}
        {rows.map((r) => (
          <details key={r.id} className="group border-b border-border last:border-0" data-testid="audit-row">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <Badge tone={r.action.includes("child_safety") || r.action.includes("failure") ? "bad" : r.action.startsWith("settings") || r.action.startsWith("policy") ? "accent" : "default"}>{r.action}</Badge>
              <span className="text-muted">{r.actorEmail ?? "system"}</span>
              {r.targetType && (
                <span className="font-mono text-xs text-muted">
                  {r.targetType}:{r.targetId?.slice(0, 12)}
                </span>
              )}
              <span className="ml-auto text-xs text-muted">
                {r.ip ?? "—"} · {formatDate(r.createdAt)}
              </span>
            </summary>
            <div className="grid gap-3 px-5 pb-4 md:grid-cols-2">
              <pre className="max-h-80 overflow-auto rounded-lg bg-fg/5 p-3 text-[11px]">
                <span className="text-muted">before </span>
                {JSON.stringify(r.before, null, 2)}
              </pre>
              <pre className="max-h-80 overflow-auto rounded-lg bg-fg/5 p-3 text-[11px]">
                <span className="text-muted">after </span>
                {JSON.stringify(r.after, null, 2)}
              </pre>
            </div>
          </details>
        ))}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {p > 0 ? <a href={qs(p - 1)} className="text-muted hover:text-fg">← Newer</a> : <span />}
        {rows.length === 50 && <a href={qs(p + 1)} className="text-muted hover:text-fg">Older →</a>}
      </div>
    </div>
  );
}
