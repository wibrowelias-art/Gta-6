import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-muted">This page doesn’t exist.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-fg underline underline-offset-4">
          Go home
        </Link>
      </div>
    </main>
  );
}
