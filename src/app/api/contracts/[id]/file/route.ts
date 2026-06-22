import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "contract", "view"))
    return new Response("Forbidden", { status: 403 });

  const contract = await db.contract.findUnique({
    where: { id },
    select: { filePath: true },
  });
  if (!contract?.filePath) return new Response("Không có file", { status: 404 });
  if (!fs.existsSync(contract.filePath))
    return new Response("File không tồn tại trên ổ đĩa", { status: 404 });

  const buf = fs.readFileSync(contract.filePath);
  const ext = path.extname(contract.filePath).toLowerCase();
  const name = path.basename(contract.filePath);
  return new Response(buf as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
