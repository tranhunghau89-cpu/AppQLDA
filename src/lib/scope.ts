// Scope theo dự án được giao (kết hợp với RBAC theo vai trò).
// ADMIN thấy tất cả; vai trò khác chỉ các dự án được gán qua ProjectMember.
import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

/**
 * Danh sách id dự án user được phép, hoặc "ALL" nếu ADMIN.
 *
 * Bọc `cache()` vì hàm này chạy nhiều lần trong CÙNG một request: layout gọi
 * `myProjects`, trang gọi `scopedProjectWhere`, có trang còn gọi thêm ở chỗ khác.
 * `cache()` gộp lại thành 1 truy vấn; khóa theo userId nên không lẫn giữa các user.
 */
const idsTheoUser = cache(async (userId: string): Promise<string[]> => {
  const rows = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
});

export async function myProjectIds(session: SessionUser): Promise<string[] | "ALL"> {
  if (session.role === "ADMIN") return "ALL";
  return idsTheoUser(session.userId);
}

/**
 * Kiểm tra user có được truy cập 1 dự án cụ thể không.
 *
 * Dùng lại danh sách đã cache thay vì `findUnique` riêng: một server action có thể
 * gọi hàm này vài lần (guard + đối chiếu thực thể), trước đây mỗi lần là 1 truy vấn.
 */
export async function canAccessProject(session: SessionUser, projectId: string): Promise<boolean> {
  const ids = await myProjectIds(session);
  return ids === "ALL" || ids.includes(projectId);
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

/** Điều kiện `where` cho các bảng có cột `projectId` (Contract, PurchaseOrder, Quote…). */
export async function scopedByProjectWhere(session: SessionUser) {
  const ids = await myProjectIds(session);
  return ids === "ALL" ? {} : { projectId: { in: ids } };
}

/**
 * Điều kiện `where` cho bảng có `projectId` cho phép NULL (vd Proposal không gắn dự án).
 * Bản ghi không gắn dự án luôn hiển thị.
 */
export async function scopedByOptionalProjectWhere(session: SessionUser) {
  const ids = await myProjectIds(session);
  return ids === "ALL" ? {} : { OR: [{ projectId: null }, { projectId: { in: ids } }] };
}
