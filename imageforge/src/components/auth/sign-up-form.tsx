"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";

export function SignUpForm({ invite, inviteOnly }: { invite: string; inviteOnly: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, setPending] = useState(false);
  const blocked = inviteOnly && !invite;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api("/api/account/sign-up", { method: "POST", json: { ...form, inviteToken: invite || undefined } });
      router.replace("/create");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur">
      <h1 className="text-xl font-semibold tracking-tight">Create your studio</h1>
      <p className="mt-1 text-sm text-muted">{blocked ? "Sign-ups are invite-only right now." : "Free to start. No card needed."}</p>
      <fieldset disabled={blocked} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" disabled={pending || blocked}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </fieldset>
      <p className="mt-6 text-center text-sm text-muted">
        Have an account?{" "}
        <Link href="/sign-in" className="text-fg underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
