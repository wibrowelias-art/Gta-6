"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Row, Section } from "./form";
import { devMutate } from "./step-up";

export function SecurityPanel({ totpEnabled, pinSet, methods }: { totpEnabled: boolean; pinSet: boolean; methods: string[] }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ secret: string; uri: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState("");
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Security" description="Sensitive console actions need a fresh check that lasts 10 minutes." />
      <Section title="Step-up methods">
        <Row label="DEV_PIN" hint="Set in server environment variables.">
          <Badge tone={pinSet ? "good" : "warn"}>{pinSet ? "configured" : "not set"}</Badge>
        </Row>
        <Row label="Authenticator app (TOTP)" hint="Any RFC 6238 app: 1Password, Authy, Google Authenticator…">
          {totpEnabled ? (
            <div className="flex items-center gap-2">
              <Badge tone="good">enabled</Badge>
              <Button size="sm" variant="ghost" onClick={async () => (await devMutate("/api/dev/totp", { method: "DELETE" }, "Authenticator removed")) && router.refresh()}>
                Remove
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={async () => setSetup(await devMutate("/api/dev/totp", { method: "POST" }, "Scan the code to continue"))}>
              Set up
            </Button>
          )}
        </Row>
        <Row label="Accepted right now">
          <span className="text-sm text-muted">{methods.join(", ")}</span>
        </Row>
      </Section>
      {setup && (
        <Section title="Finish authenticator setup">
          <div className="flex flex-col gap-4 p-5 sm:flex-row">
            <div className="h-48 w-48 shrink-0 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
            <div className="space-y-3 text-sm">
              <p className="text-muted">Scan the code, or enter this key manually:</p>
              <code className="block break-all rounded-lg bg-fg/5 p-2 font-mono text-xs">{setup.secret}</code>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await devMutate("/api/dev/totp", { method: "PUT", json: { code } }, "Authenticator enabled")) {
                    setSetup(null);
                    router.refresh();
                  }
                }}
              >
                <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
                <Button type="submit" size="sm">
                  Verify
                </Button>
              </form>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
