"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ magicLink, next }: { magicLink: boolean; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("password");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      if (mode === "magic") {
        const { error } = await authClient.signIn.magicLink({ email, callbackURL: next });
        if (error) toast.error(error.message ?? "Could not send link");
        else toast.success("Check your inbox for a sign-in link.");
        return;
      }
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(error.status === 403 ? (error.message ?? "Account unavailable") : "Wrong email or password.");
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur">
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to your studio.</p>
      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "password" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : mode === "magic" ? "Email me a link" : "Sign in"}
        </Button>
        {magicLink && (
          <button type="button" className="w-full text-center text-xs text-muted hover:text-fg" onClick={() => setMode(mode === "magic" ? "password" : "magic")}>
            {mode === "magic" ? "Use password instead" : "Sign in with a magic link"}
          </button>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/sign-up" className="text-fg underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
