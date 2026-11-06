import { Logo } from "@/components/brand";
import { getBranding } from "@/server/branding";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <div className="glow relative grid min-h-dvh place-items-center px-4">
      <div className="absolute left-5 top-5">
        <Logo name={b.appName} logoUrl={b.logoUrl} />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
