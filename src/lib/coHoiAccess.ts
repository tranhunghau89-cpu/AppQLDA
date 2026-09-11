// Quyền vào một cơ hội chào giá — bản song song của `denyProject`/`requireProjectView`
// bên `auth.ts`, cho những thứ sống ở CRM thay vì ở dự án.
//
// Khác biệt duy nhất nằm ở trục thứ hai: dự án chặn theo `ProjectMember`, cơ hội chặn
// theo người phụ trách KHÁCH (cơ hội không giữ chủ riêng — xem `crmScope.ts`). Trục vai
// trò vẫn là RBAC như mọi nơi khác.
import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { getSession, requireView } from "./auth";
import { can, type Role, type Resource, type Action } from "./rbac";
import { duocDungKhachHang } from "./crmScope";
import type { SessionUser } from "./session";

export const NGOAI_PHAM_VI_CO_HOI = "Cơ hội này thuộc về khách do người khác phụ trách.";

/** Cơ hội này do ai phụ trách — `undefined` nghĩa là không tìm thấy. */
async function chuCuaCoHoi(coHoiId: string): Promise<string | null | undefined> {
  if (!coHoiId) return undefined;
  const ch = await db.coHoi.findUnique({
    where: { id: coHoiId },
    select: { khachHang: { select: { ownerId: true } } },
  });
  return ch ? ch.khachHang.ownerId : undefined;
}

/** Người này có được vào cơ hội đó không. */
export async function canAccessCoHoi(
  session: SessionUser,
  coHoiId: string
): Promise<boolean> {
  const ownerId = await chuCuaCoHoi(coHoiId);
  if (ownerId === undefined) return false;
  return duocDungKhachHang(session, ownerId);
}

/**
 * Trang chi tiết của một cơ hội: cần quyền xem theo vai trò VÀ cơ hội trong phạm vi.
 * Ngoài phạm vi -> 404, giống `requireProjectView`: không tiết lộ cơ hội có tồn tại không.
 */
export async function requireCoHoiView(
  resource: Resource,
  coHoiId: string
): Promise<SessionUser> {
  const session = await requireView(resource);
  if (!(await canAccessCoHoi(session, coHoiId))) notFound();
  return session;
}

/**
 * Bản không ném lỗi, cho server action — trả `null` khi hợp lệ, ngược lại trả thẳng
 * ActionResult lỗi. Cùng hình dạng với `denyProject` để hai nhánh của `guard` đọc giống
 * nhau.
 */
export async function denyCoHoi(
  resource: Resource,
  action: Action,
  coHoiId: string,
  fallback: string
): Promise<{ ok: false; error: string } | null> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (!can(session.role as Role, resource, action)) return { ok: false, error: fallback };
  if (!(await canAccessCoHoi(session, coHoiId))) {
    return { ok: false, error: NGOAI_PHAM_VI_CO_HOI };
  }
  return null;
}
