// Scope theo dự án được giao (kết hợp với RBAC theo vai trò).
// ADMIN thấy tất cả; vai trò khác chỉ các dự án được gán qua ProjectMember.
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

/** Danh sách id dự án user được phép, hoặc "ALL" nếu ADMIN. */
export async function myProjectIds(session: SessionUser): Promise<string[] | "ALL"> {
  if (session.role === "ADMIN") return "ALL";
  const rows = await db.projectMember.findMany({
    where: { userId: session.userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

/** Kiểm tra user có được truy cập 1 dự án cụ thể không. */
export async function canAccessProject(session: SessionUser, projectId: string): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  const m = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.userId } },
    select: { id: true },
  });
  return !!m;
}

/** Điều kiện `where` để lọc Project theo scope (rỗng nếu ADMIN). */
export async function scopedProjectWhere(session: SessionUser) {
  const ids = await myProjectIds(session);
  return ids === "ALL" ? {} : { id: { in: ids } };
}

/** Các dự án trong phạm vi (dùng cho dropdown Quick-Add). */
export async function myProjects(session: SessionUser) {
  const where = await scopedProjectWhere(session);
  return db.project.findMany({
    where,
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}
