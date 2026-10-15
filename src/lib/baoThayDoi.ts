// Báo thay đổi trong dự án (hợp đồng, thiết kế, thanh toán, thông tin dự án) tới đúng
// người — đi qua chuông + hộp thư Trao đổi như các tin khác.
import { db } from "@/lib/db";
import { canAccessProject } from "@/lib/scope";
import type { Role } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";

export type NhomThayDoi = "HOP_DONG" | "THIET_KE" | "THANH_TOAN" | "DU_AN";

export const TEN_NHOM_THAY_DOI: Record<NhomThayDoi, string> = {
  HOP_DONG: "Hợp đồng",
  THIET_KE: "Thiết kế",
  THANH_TOAN: "Thanh toán",
  DU_AN: "Thông tin dự án",
};

/** Đuôi đường dẫn từ trang dự án tới chỗ thay đổi. */
export const MUC_NHOM_THAY_DOI: Record<NhomThayDoi, string> = {
  HOP_DONG: "/contract",
  THIET_KE: "#ho-so",
  THANH_TOAN: "#tai-chinh",
  DU_AN: "#tong-quan",
};

/** Phòng nhận theo nhóm — cộng thêm thành viên dự án ở mọi nhóm. */
export const PHONG_NHAN: Record<NhomThayDoi, Role[]> = {
  HOP_DONG: ["ADMIN", "ACCOUNTING"],
  THIET_KE: ["ENGINEERING"],
  THANH_TOAN: ["ACCOUNTING"],
  DU_AN: [],
};

export function laNhomThayDoi(x: string): x is NhomThayDoi {
  return x in TEN_NHOM_THAY_DOI;
}

/** Sửa liên tiếp trong cửa sổ này thì gộp vào tin chưa đọc cũ, khỏi dội chuông. */
const GOP_TRONG_MS = 30 * 60_000;

/**
 * Ghi tin báo thay đổi. Không bao giờ ném lỗi ra ngoài: thông báo hỏng không được làm
 * hỏng thao tác lưu chính.
 */
export async function baoThayDoi(v: {
  projectId: string;
  nhom: NhomThayDoi;
  noiDung: string;
  tacGia: Pick<SessionUser, "userId" | "name">;
}): Promise<void> {
  try {
    const p = await db.project.findUnique({
      where: { id: v.projectId },
      select: { code: true, members: { select: { userId: true } } },
    });
    if (!p) return;

    const phong = PHONG_NHAN[v.nhom];
    const ung = await db.user.findMany({
      where: {
        active: true,
        id: { not: v.tacGia.userId },
        OR: [
          { id: { in: p.members.map((m) => m.userId) } },
          ...(phong.length ? [{ role: { in: phong } }] : []),
        ],
      },
      select: { id: true, role: true },
    });
    // Ngoài phạm vi dự án thì không được đọc nội dung — không nhắn.
    const xem = await Promise.all(
      ung.map((u) => canAccessProject({ userId: u.id, role: u.role as Role } as SessionUser, v.projectId)),
    );
    const nhan = ung.filter((_, i) => xem[i]).map((u) => u.id);
    if (nhan.length === 0) return;

    const cu = await db.traoDoi.findFirst({
      where: {
        doiTuong: v.nhom,
        doiTuongId: v.projectId,
        tacGiaId: v.tacGia.userId,
        createdAt: { gte: new Date(Date.now() - GOP_TRONG_MS) },
        nguoiNhan: { none: { daDocLuc: { not: null } } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, noiDung: true },
    });
    if (cu && cu.noiDung.length < 3000) {
      await db.traoDoi.update({
        where: { id: cu.id },
        data: {
          noiDung: `${cu.noiDung}\n${v.noiDung}`,
          createdAt: new Date(),
          nguoiNhan: {
            createMany: { data: nhan.map((userId) => ({ userId })), skipDuplicates: true },
          },
        },
      });
      return;
    }

    await db.traoDoi.create({
      data: {
        doiTuong: v.nhom,
        doiTuongId: v.projectId,
        projectId: v.projectId,
        nhanDe: `${p.code} · ${TEN_NHOM_THAY_DOI[v.nhom]}`,
        loai: "GHI_CHU",
        noiDung: v.noiDung,
        tacGiaId: v.tacGia.userId,
        tacGiaTen: v.tacGia.name,
        nguoiNhan: { create: nhan.map((userId) => ({ userId })) },
      },
    });
  } catch (e) {
    console.error("[baoThayDoi] không ghi được thông báo:", e);
  }
}
