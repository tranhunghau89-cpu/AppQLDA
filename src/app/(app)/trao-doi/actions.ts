"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { duocXemViec } from "@/lib/traoDoi";
import { khaNangDuyet } from "@/lib/duyetNhanh";
import { guiTraoDoi } from "@/components/trao-doi/actions";
import { chuyenBuoc } from "../projects/[id]/quyTrinhActions";

/**
 * Đồng ý / Cần sửa ngay từ hộp thư. Đi qua đúng action của từng loại việc (bước quy
 * trình đổi trạng thái; báo giá thêm tin quyết định) để không có lối duyệt thứ hai
 * lách được kiểm tra của trang gốc.
 */
export async function duyetNhanh(
  traoDoiId: string,
  quyet: "DONG_Y" | "CAN_SUA",
  ghiChu: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Phiên đăng nhập hết hạn." };
  if (quyet !== "DONG_Y" && quyet !== "CAN_SUA") return { ok: false, error: "Thao tác không hợp lệ." };
  const nd = String(ghiChu ?? "").trim();
  if (nd.length > 2000) return { ok: false, error: "Ghi chú quá dài (tối đa 2000 ký tự)." };
  if (quyet === "CAN_SUA" && !nd) return { ok: false, error: "Ghi rõ cần sửa gì." };

  // Chỉ người được nhắn mới duyệt từ hộp thư.
  const nhan = await db.traoDoiNhan.findFirst({
    where: { traoDoiId, userId: session.userId },
    include: { traoDoi: true },
  });
  if (!nhan || !(await duocXemViec(session, nhan.traoDoi)))
    return { ok: false, error: "Không tìm thấy tin này hoặc bạn không có quyền xem." };
  const t = nhan.traoDoi;

  const kn = await khaNangDuyet(session, t);
  if (!kn.duoc) return { ok: false, error: kn.lyDo };

  const r = kn.buoc
    ? await chuyenBuoc(kn.buoc.projectId, kn.buoc.buoc, quyet === "DONG_Y" ? "DUYET" : "TRA_LAI", nd)
    : await guiTraoDoi(t.doiTuong as "CLIENT_QUOTE" | "QUOTE", t.doiTuongId, {
        loai: quyet,
        noiDung: nd,
        nguoiNhanIds: [t.tacGiaId],
      });
  if (!r.ok) return { ok: false, error: r.error ?? "Không duyệt được." };

  await db.traoDoiNhan.update({ where: { id: nhan.id }, data: { daDocLuc: nhan.daDocLuc ?? new Date() } });
  revalidatePath("/trao-doi");
  revalidatePath("/", "layout");
  return { ok: true };
}
