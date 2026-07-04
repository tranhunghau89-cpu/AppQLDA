import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { signedUrl } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "purchase", "view"))
    return new Response("Forbidden", { status: 403 });

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    select: { filePath: true },
  });
  if (!order?.filePath) return new Response("Không có file", { status: 404 });

  // Local: đọc từ ổ đĩa nếu file còn tồn tại. Cloud: filePath là key Storage → redirect signed URL.
  if (!fs.existsSync(order.filePath)) {
    const url = await signedUrl(order.filePath);
    if (url) return Response.redirect(url, 302);
    return new Response("File không tồn tại", { status: 404 });
  }

  const buf = fs.readFileSync(order.filePath);
  const ext = path.extname(order.filePath).toLowerCase();
  const name = path.basename(order.filePath);
  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
