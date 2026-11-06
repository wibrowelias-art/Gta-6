"use client";
import { Download, MoreHorizontal, Search } from "lucide-react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { PageHeader, Section } from "./form";
import { devMutate, downloadDev } from "./step-up";

type U = {
  id: string;
  email: string;
  name: string;
  role: "user" | "moderator" | "developer";
  planId: string;
  banned: boolean;
  createdAt: string;
  images: number;
  usedToday: number;
  overrideDaily: number | null;
  overrideMonthly: number | null;
};

export function UsersPanel({ users, q, me, plans }: { users: U[]; q: string; me: string; plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const act = async (body: Record<string, unknown>, msg: string) => {
    if (await devMutate("/api/dev/users", { method: "POST", json: body }, msg)) router.refresh();
  };
  return (
    <div className="max-w-5xl">
      <PageHeader title="Users" description="Promote, ban, wipe generations, change plans and reset quotas. Every action is audited.">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => downloadDev("/api/dev/users/export", `imageforge-users-${new Date().toISOString().slice(0, 10)}.csv`)}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/dev/users?q=${encodeURIComponent(query)}`);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <Input className="pl-9" placeholder="Search email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <Section title={`${users.length} users`}>
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm" data-testid="user-row">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {u.name} {u.id === me && <span className="text-xs text-muted">(you)</span>}
              </p>
              <p className="truncate text-xs text-muted">
                {u.email} · joined {formatDate(u.createdAt)}
              </p>
            </div>
            <Badge tone={u.role === "developer" ? "accent" : "default"}>{u.role}</Badge>
            <Badge>{u.planId}</Badge>
            {u.banned && <Badge tone="bad">banned</Badge>}
            <span className="w-24 text-right text-xs tabular-nums text-muted">
              {u.images} imgs · {u.usedToday} today
              {u.overrideDaily != null && <span className="block">override {u.overrideDaily}/day</span>}
            </span>
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button size="icon" variant="ghost" aria-label="Actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" className="z-50 min-w-48 rounded-xl border border-border bg-card p-1 text-sm shadow-2xl">
                  {(["user", "moderator", "developer"] as const)
                    .filter((r) => r !== u.role)
                    .map((r) => (
                      <Item key={r} onSelect={() => act({ action: "set_role", userId: u.id, role: r }, `Role set to ${r}`)}>
                        Make {r}
                      </Item>
                    ))}
                  {plans
                    .filter((p) => p.id !== u.planId)
                    .map((p) => (
                      <Item key={p.id} onSelect={() => act({ action: "set_plan", userId: u.id, planId: p.id }, `Plan set to ${p.name}`)}>
                        Move to {p.name}
                      </Item>
                    ))}
                  <Item onSelect={() => act({ action: "reset_quota", userId: u.id }, "Quota reset")}>Reset quota</Item>
                  <Item
                    onSelect={() => {
                      const v = window.prompt("Daily quota override (blank clears)", u.overrideDaily?.toString() ?? "");
                      if (v === null) return;
                      const n = v.trim() === "" ? null : Number(v);
                      void act({ action: "set_quota_override", userId: u.id, dailyQuota: Number.isFinite(n) ? n : null, monthlyQuota: u.overrideMonthly }, "Override saved");
                    }}
                  >
                    Set daily override…
                  </Item>
                  <Menu.Separator className="my-1 h-px bg-border" />
                  {u.banned ? (
                    <Item onSelect={() => act({ action: "unban", userId: u.id }, "Unbanned")}>Unban</Item>
                  ) : (
                    <Item danger onSelect={() => act({ action: "ban", userId: u.id }, "Banned")}>
                      Ban
                    </Item>
                  )}
                  <Item danger onSelect={() => window.confirm(`Delete all ${u.images} images for ${u.email}?`) && act({ action: "wipe_generations", userId: u.id }, "Generations wiped")}>
                    Wipe generations
                  </Item>
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Item({ children, onSelect, danger }: { children: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item onSelect={onSelect} className={`cursor-pointer rounded-lg px-3 py-1.5 outline-none data-[highlighted]:bg-fg/5 ${danger ? "text-red-500" : ""}`}>
      {children}
    </Menu.Item>
  );
}
