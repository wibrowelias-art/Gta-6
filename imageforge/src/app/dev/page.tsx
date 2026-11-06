import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getOverview } from "@/server/observability";
import { getConfigUncached, SETTINGS_TTL_MS } from "@/server/settings/store";

export default async function DevOverview() {
  const [o, cfg] = await Promise.all([getOverview(), getConfigUncached()]);
  const stats = [
    { label: "Queue depth", value: o.queueDepth, testid: "queue-depth" },
    { label: "Jobs · 24h", value: o.jobs24h },
    { label: "Error rate · 24h", value: `${(o.errorRate24h * 100).toFixed(1)}%` },
    { label: "Blocked · 24h", value: o.blocked24h },
    { label: "Est. cost · 24h", value: `$${o.cost24h.toFixed(2)}` },
    { label: "Users", value: o.users },
  ];
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          Settings v{cfg.version} · servers pick up changes within {SETTINGS_TTL_MS / 1000}s · {o.images} images stored
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums" data-testid={s.testid}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Top refusal reasons · 7 days</h2>
          {o.topRefusals.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No refusals yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {o.topRefusals.map((r) => {
                const max = o.topRefusals[0]!.n;
                return (
                  <li key={r.category} className="text-sm">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        {r.category}
                        {r.hard && <Badge tone="bad">hard</Badge>}
                      </span>
                      <span className="tabular-nums text-muted">{r.n}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-fg/5">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Recent jobs</h2>
          {o.recent.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No jobs yet.</p>
          ) : (
            <table className="mt-3 w-full text-left text-xs">
              <tbody className="divide-y divide-border">
                {o.recent.map((j) => (
                  <tr key={j.id}>
                    <td className="py-1.5">
                      <Badge tone={j.status === "succeeded" ? "good" : j.status === "failed" ? "bad" : j.status === "blocked" ? "warn" : "default"}>{j.status}</Badge>
                    </td>
                    <td className="py-1.5 font-mono text-muted">{j.provider ? `${j.provider}:${j.model}` : "—"}</td>
                    <td className="py-1.5 text-muted">{j.source}</td>
                    <td className="py-1.5 tabular-nums text-muted">{j.latencyMs ? `${j.latencyMs}ms` : (j.errorCode ?? "")}</td>
                    <td className="py-1.5 text-right text-muted">{formatDate(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
