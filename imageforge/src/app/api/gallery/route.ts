import { requireApiUser } from "@/server/auth/guards";
import { listGallery } from "@/server/gallery";
import { handler, ok } from "@/server/http";

export const GET = handler(async (req: Request) => {
  const { user } = await requireApiUser(req);
  const url = new URL(req.url);
  return ok(await listGallery(user.id, { cursor: url.searchParams.get("cursor") ?? undefined, favorites: url.searchParams.get("favorites") === "1" }));
});
