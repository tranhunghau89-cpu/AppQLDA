// Scope theo dự án (kết hợp với RBAC theo vai trò).
// XEM: mọi vai trò thấy tất cả dự án — xem được nội dung gì là do RBAC theo phòng ban quyết.
// SỬA: ADMIN sửa mọi dự án; vai trò khác chỉ sửa dự án mình là thành viên (ProjectMember).
import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

/**
 * Id các dự án user là thành viên.
 *
 * Bọc `cache()` vì hàm này chạy nhiều lần trong CÙNG một request: layout gọi
 * `myProjects`, trang gọi `canEditProject`, có trang còn gọi thêm ở chỗ khác.
 * `cache()` gộp lại thành 1 truy vấn; khóa theo userId nên không lẫn giữa các user.
 */
const idsTheoUser = cache(async (userId: string): Promise<string[]> => {
  const rows = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
});

/** Phạm vi XEM: mọi vai trò đều thấy tất cả dự án. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function myProjectIds(session: SessionUser): Promise<string[] | "ALL"> {
  return "ALL";
}

/** Kiểm tra user có được XEM 1 dự án không. Hiện ai đăng nhập cũng xem được. */
export async function canAccessProject(session: SessionUser, projectId: string): Promise<boolean> {
  const ids = await myProjectIds(session);
  return ids === "ALL" || ids.includes(projectId);
}

/** Phạm vi SỬA: id dự án user được thêm/sửa/xóa dữ liệu, hoặc "ALL" nếu ADMIN. */
export async function myEditableProjectIds(session: SessionUser): Promise<string[] | "ALL"> {
  if (session.role === "ADMIN") return "ALL";
  return idsTheoUser(session.userId);
}

/**
 * Kiểm tra user có được SỬA dữ liệu của 1 dự án không (ADMIN hoặc thành viên).
 * Cũng dùng để lọc người nhận chuông / người được giao việc: họ phải là người làm dự án.
 */
export async function canEditProject(session: SessionUser, projectId: string): Promise<boolean> {
  const ids = await myEditableProjectIds(session);
  return ids === "ALL" || ids.includes(projectId);
}

/** Điều kiện `where` để lọc Project theo phạm vi xem (rỗng = tất cả). */
export async function scopedProjectWhere(session: SessionUser) {
  const ids = await myProjectIds(session);
  return ids === "ALL" ? {} : { id: { in: ids } };
}

/** Các dự án user được sửa (dùng cho dropdown Quick-Add, tạo đề xuất…). */
export async function myProjects(session: SessionUser) {
  const ids = await myEditableProjectIds(session);
  return db.project.findMany({
    where: ids === "ALL" ? {} : { id: { in: ids } },
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
