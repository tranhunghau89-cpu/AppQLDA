// Đọc phía server cho hộp thư trao đổi. Không phải server action: nhận userId từ
// phiên ở server component, không để trình duyệt truyền vào.
import { db } from "@/lib/db";
import { can, type Role } from "@/lib/rbac";
import { canAccessProject } from "@/lib/scope";
import { canAccessCoHoi } from "@/lib/coHoiAccess";
import type { SessionUser } from "@/lib/session";
import { MUC_NHOM_THAY_DOI, laNhomThayDoi } from "@/lib/baoThayDoi";

/** Chủ của việc mà tin trao đổi gắn vào. */
export type ChuViec = { projectId: string | null; coHoiId: string | null; doiTuong?: string };

/** Người này có được xem việc (và trao đổi của nó) không. */
export async function duocXemViec(
  ai: Pick<SessionUser, "userId" | "role">,
  chu: ChuViec
): Promise<boolean> {
  const s = ai as SessionUser;
  // Bước quy trình dự án: ai xem được dự án là xem được, không cần quyền báo giá.
  // Nhắc việc chỉ đọc được qua dòng nhận của chính mình — không có việc gốc để kiểm.
  if (chu.doiTuong === "NHAC_VIEC") return true;
  if (chu.doiTuong === "BUOC" || (chu.doiTuong && laNhomThayDoi(chu.doiTuong))) return !!chu.projectId && canAccessProject(s, chu.projectId);
  if (!can(ai.role as Role, "quote", "view")) return false;
  if (chu.projectId) return canAccessProject(s, chu.projectId);
  if (chu.coHoiId) return canAccessCoHoi(s, chu.coHoiId);
  return false;
}

export { LOAI_TRAO_DOI_LABEL } from "@/lib/traoDoiNhan";

export function demChuaDoc(userId: string): Promise<number> {
  return db.traoDoiNhan.count({ where: { userId, daDocLuc: null } });
}

/** Trang mở đúng việc mà tin trao đổi nói tới. */
export function duongDanViec(t: {
  doiTuong: string;
  doiTuongId: string;
  projectId: string | null;
  coHoiId: string | null;
}): string {
  if (t.doiTuong === "NHAC_VIEC") return "/";
  if (t.doiTuong === "BUOC") return `/projects/${t.projectId}#quy-trinh`;
  if (laNhomThayDoi(t.doiTuong)) return `/projects/${t.projectId}${MUC_NHOM_THAY_DOI[t.doiTuong]}`;
  const goc = t.projectId ? `/projects/${t.projectId}` : `/co-hoi/${t.coHoiId}`;
  return t.doiTuong === "CLIENT_QUOTE"
    ? `${goc}/client-quote?mo=${t.doiTuongId}#trao-doi`
    : `${goc}/quote#trao-doi-${t.doiTuongId}`;
}

/**
 * Báo giá gửi khách đã được đồng ý chưa: tin quyết định MỚI NHẤT (xin duyệt / cần sửa /
 * đồng ý) phải là "Đồng ý". Xin duyệt lại sau khi được đồng ý thì phải chờ duyệt lại.
 */
export async function daDuocDongY(clientQuoteId: string, nguoiGuiId: string): Promise<boolean> {
  const cuoi = await db.traoDoi.findFirst({
    where: {
      doiTuong: "CLIENT_QUOTE",
      doiTuongId: clientQuoteId,
      loai: { in: ["XIN_DUYET", "CAN_SUA", "DONG_Y"] },
    },
    orderBy: { createdAt: "desc" },
    select: { loai: true, tacGiaId: true },
  });
  if (cuoi?.loai !== "DONG_Y" || cuoi.tacGiaId === nguoiGuiId) return false;
  const nguoiDuyet = await db.user.findUnique({ where: { id: cuoi.tacGiaId }, select: { role: true } });
  return !!nguoiDuyet && (await duocDuyet({ userId: cuoi.tacGiaId, role: nguoiDuyet.role as never }));
}

/** Quản trị, hoặc người được Quản trị giao quyền duyệt báo giá. Đọc cờ từ CSDL, không từ phiên. */
export async function duocDuyet(ai: Pick<SessionUser, "userId" | "role">): Promise<boolean> {
  if (ai.role === "ADMIN") return true;
  const u = await db.user.findUnique({ where: { id: ai.userId }, select: { duocDuyet: true, active: true } });
  return !!u?.active && u.duocDuyet;
}
