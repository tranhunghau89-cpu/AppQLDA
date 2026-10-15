// Phiếu bảo hành — nhãn dùng chung và tin nhắn riêng cho người phụ trách.
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export { TRANG_THAI_BAO_HANH, BAO_HANH_MO } from "@/lib/baoHanhNhan";

/** Nhắn riêng người phụ trách phiếu (giao việc). */
export async function nhanTinBaoHanh(
  phieu: { id: string; projectId: string; phuTrachId: string | null },
  tacGia: Pick<SessionUser, "userId" | "name">,
  noiDung: string,
  canXuLy: boolean,
): Promise<void> {
  if (!phieu.phuTrachId || phieu.phuTrachId === tacGia.userId) return;
  const p = await db.project.findUnique({ where: { id: phieu.projectId }, select: { code: true } });
  await db.traoDoi.create({
    data: {
      doiTuong: "BAO_HANH",
      doiTuongId: phieu.projectId,
      projectId: phieu.projectId,
      nhanDe: `${p?.code ?? ""} · Bảo hành`,
      loai: canXuLy ? "CAN_SUA" : "GHI_CHU",
      noiDung,
      tacGiaId: tacGia.userId,
      tacGiaTen: tacGia.name,
      nguoiNhan: { create: [{ userId: phieu.phuTrachId }] },
    },
  });
}
