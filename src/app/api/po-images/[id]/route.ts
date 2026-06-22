import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "purchase", "view"))
    return new Response("Forbidden", { status: 403 });

  const img = await db.poItemImage.findUnique({
    where: { id },
    select: { mime: true, data: true },
  });
  if (!img) return new Response("Không có ảnh", { status: 404 });

  const buf = Buffer.isBuffer(img.data) ? img.data : Buffer.from(img.data);
  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": img.mime || "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
