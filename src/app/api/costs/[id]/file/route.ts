import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";

const MIME: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "cost", "view")) return new Response("Forbidden", { status: 403 });

  const cs = await db.costSummary.findUnique({ where: { id }, select: { filePath: true } });
  if (!cs?.filePath) return new Response("Không có file", { status: 404 });
  if (!fs.existsSync(cs.filePath))
    return new Response("File không tồn tại trên ổ đĩa", { status: 404 });

  const buf = fs.readFileSync(cs.filePath);
  const ext = path.extname(cs.filePath).toLowerCase();
  const name = path.basename(cs.filePath);
  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
