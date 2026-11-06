import "server-only";

export type ReqMeta = { ip: string | null; userAgent: string | null };

export function metaFromHeaders(h: Headers): ReqMeta {
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]?.trim() : null) || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
