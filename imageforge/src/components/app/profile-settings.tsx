"use client";
import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Usage = { remaining: number; limits: { daily: number; monthly: number }; used: { daily: number; monthly: number }; planId: string };

export function ProfileSettings({ name, email, theme, usage }: { name: string; email: string; theme: "dark" | "light"; usage: Usage }) {
  const router = useRouter();
  const [display, setDisplay] = useState(name);
  const [t, setT] = useState(theme);
  const [saving, setSaving] = useState(false);

  async function setTheme(next: "dark" | "light") {
    setT(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    await api("/api/me", { method: "PATCH", json: { theme: next } }).catch(() => toast.error("Couldn’t save theme."));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await api("/api/me", { method: "PATCH", json: { name: display } });
              toast.success("Saved");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "Couldn’t save.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input id="display" value={display} maxLength={60} onChange={(e) => setDisplay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="text-sm text-muted">{email}</p>
          </div>
          <Button type="submit" size="sm" disabled={saving || display.trim() === name || !display.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <Label>Theme</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["dark", "light"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setTheme(v)}
              aria-pressed={t === v}
              data-testid={`theme-${v}`}
              className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm capitalize", t === v ? "border-accent bg-accent/10" : "border-border text-muted")}
            >
              {v === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {v}
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <Label>Usage</Label>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-muted">Today</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {usage.used.daily}/{usage.limits.daily}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">This month</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {usage.used.monthly}/{usage.limits.monthly}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Plan</dt>
            <dd className="mt-1 font-semibold capitalize">{usage.planId}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
