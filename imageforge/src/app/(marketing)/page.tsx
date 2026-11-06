import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getBranding } from "@/server/branding";

export default async function Landing() {
  const b = await getBranding();
  return (
    <div className="glow">
      <section className="mx-auto max-w-4xl px-5 pb-20 pt-16 text-center sm:pt-28">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Prompt to picture in seconds
        </p>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          One prompt.
          <br />
          <span className="bg-gradient-to-r from-fg to-accent bg-clip-text text-transparent">Beautiful images.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted sm:text-lg">
          {b.appName} is a calm, fast studio for making images. Type an idea, pick a look, and get up to four takes at once.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Start creating <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-border bg-card/70 p-3 text-left shadow-2xl backdrop-blur">
          <div className="rounded-xl border border-border bg-bg/60 px-4 py-4 font-mono text-sm text-muted">
            a lighthouse on a basalt cliff at blue hour, long exposure, soft fog<span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-accent align-middle" />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-lg"
                style={{ background: `linear-gradient(${135 + i * 30}deg, color-mix(in oklab, var(--accent) ${40 - i * 6}%, #0b0b10), #12121a 70%)` }}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-24 sm:grid-cols-3">
        {[
          { icon: Zap, t: "Fast by default", d: "Up to four images per prompt, ready to download." },
          { icon: Sparkles, t: "Curated styles", d: "Pick a look without learning prompt tricks." },
          { icon: Shield, t: "Private by default", d: "Your generations are only visible to you." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl border border-border bg-card/60 p-5">
            <Icon className="h-5 w-5 text-accent" />
            <h2 className="mt-3 text-sm font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
