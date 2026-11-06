import { getBranding } from "@/server/branding";

export const metadata = { title: "About" };

export default async function About() {
  const b = await getBranding();
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 text-sm leading-7 text-muted">
      <h1 className="text-3xl font-semibold tracking-tight text-fg">About {b.appName}</h1>
      <p className="mt-6">
        {b.appName} turns a short text prompt into images using third-party image models. It is an independent product and is not affiliated with any
        game studio, model provider, or other image service.
      </p>
      <h2 className="mt-10 text-base font-semibold text-fg">The short version</h2>
      <p className="mt-3 rounded-xl border border-border bg-card p-4 text-fg">
        You own the prompts you type. The image providers’ terms of service apply to generated output. Illegal content is prohibited. Your generations are
        private by default.
      </p>
      <h2 className="mt-10 text-base font-semibold text-fg">Privacy</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Generations are private to your account unless you choose to share one (when sharing is enabled).</li>
        <li>We do not train models on your prompts or images.</li>
        <li>Images are deleted automatically after the retention period set by the operator, or immediately when you delete them.</li>
      </ul>
      {b.supportEmail && (
        <p className="mt-10">
          Questions? <a className="text-fg underline underline-offset-4" href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a>
        </p>
      )}
    </article>
  );
}
