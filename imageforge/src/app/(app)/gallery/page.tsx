import { GalleryView } from "@/components/app/gallery-view";
import { requireUser } from "@/server/auth/session";
import { listGallery } from "@/server/gallery";
import { getSettings } from "@/server/settings/store";

export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const user = await requireUser();
  const [g, s] = await Promise.all([listGallery(user.id), getSettings()]);
  return <GalleryView initial={g.items} nextCursor={g.nextCursor} remix={s.access.flags.remix} share={s.access.flags.publicShare} />;
}
