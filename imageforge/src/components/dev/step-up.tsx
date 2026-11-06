"use client";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

type Method = "pin" | "totp" | "password";
let opener: (() => Promise<boolean>) | null = null;

/** Calls a developer API; on STEP_UP_REQUIRED prompts for PIN/TOTP and retries once. */
export async function devApi<T = unknown>(url: string, init?: Parameters<typeof api>[1]): Promise<T> {
  try {
    return await api<T>(url, init);
  } catch (e) {
    if (e instanceof ApiError && e.code === "STEP_UP_REQUIRED" && opener) {
      const okay = await opener();
      if (okay) return api<T>(url, init);
    }
    throw e;
  }
}

/** Toast helper for developer mutations. */
export async function devMutate<T = unknown>(url: string, init: Parameters<typeof api>[1], success = "Saved"): Promise<T | null> {
  try {
    const res = await devApi<T>(url, init);
    toast.success(success);
    return res;
  } catch (e) {
    const err = e as ApiError;
    const details = Array.isArray(err.details) ? (err.details as { path: string; message: string }[]).slice(0, 3).map((d) => `${d.path}: ${d.message}`).join(" · ") : "";
    toast.error(err.message ?? "Failed", { description: details || undefined });
    return null;
  }
}

const labels: Record<Method, string> = { pin: "Developer PIN", totp: "Authenticator code", password: "Account password" };

export function StepUpProvider() {
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<Method[]>([]);
  const [method, setMethod] = useState<Method>("pin");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback(async () => {
    const s = await api<{ methods: Method[] }>("/api/dev/step-up").catch(() => ({ methods: ["pin"] as Method[] }));
    setMethods(s.methods);
    setMethod(s.methods[0] ?? "pin");
    setCode("");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => {
    opener = ask;
    return () => {
      opener = null;
    };
  }, [ask]);

  function close(v: boolean) {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api("/api/dev/step-up", { method: "POST", json: { method, code } });
      toast.success("Verified for 10 minutes");
      window.dispatchEvent(new Event("imageforge:stepup"));
      close(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <DialogTitle>Confirm it’s you</DialogTitle>
          </div>
          <DialogDescription>Sensitive developer actions need a fresh check. It lasts 10 minutes.</DialogDescription>
          {methods.length > 1 && (
            <div className="flex gap-1 rounded-lg bg-fg/5 p-1">
              {methods.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={`flex-1 rounded-md px-2 py-1 text-xs ${method === m ? "bg-card text-fg shadow" : "text-muted"}`}>
                  {labels[m]}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="stepup-code">{labels[method]}</Label>
            <Input
              id="stepup-code"
              autoFocus
              type={method === "password" ? "password" : "text"}
              inputMode={method === "password" ? undefined : "numeric"}
              autoComplete={method === "totp" ? "one-time-code" : "off"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending || !code}>
            {pending ? "Checking…" : "Verify"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StepUpStatus() {
  const [exp, setExp] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => {
    api<{ expiresAt: number | null }>("/api/dev/step-up")
      .then((r) => setExp(r.expiresAt))
      .catch(() => setExp(null));
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(Date.now()), 15_000);
    window.addEventListener("imageforge:stepup", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("imageforge:stepup", refresh);
    };
  }, [refresh]);
  const active = exp && exp > now;
  return (
    <button
      type="button"
      onClick={() => (active ? undefined : opener?.())}
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${active ? "border-emerald-500/30 text-emerald-500" : "border-border text-muted hover:text-fg"}`}
    >
      <ShieldCheck className="h-4 w-4" />
      {active ? `Verified · ${Math.max(1, Math.round((exp - now) / 60000))} min left` : "Locked · click to verify"}
    </button>
  );
}
