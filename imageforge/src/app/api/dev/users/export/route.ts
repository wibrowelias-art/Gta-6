import { writeAudit } from "@/server/audit";
import { requireDevApi } from "@/server/auth/guards";
import { handler } from "@/server/http";
import { usersCsv } from "@/server/users-admin";

export const GET = handler(async (req: Request) => {
  const { actor, meta } = await requireDevApi(req, { stepUp: true });
  const csv = await usersCsv();
  await writeAudit({ actor, action: "users.export_csv", targetType: "user", meta });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="imageforge-users-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
});
