// Duyệt nhanh từ hộp thư: một tin "Xin duyệt" còn chờ, và người đang xem được quyết nó.
// Không phải server action — trang hộp thư và action duyệt nhanh cùng gọi để kiểm tra.
import { db } from "@/lib/db";
import { duocDuyetBuoc } from "@/lib/quyTrinh";
import { napQuyTrinh } from "@/lib/quyTrinhDb";
import { duocDuyet } from "@/lib/traoDoi";
import type { SessionUser } from "@/lib/session";

type TinXin = { id: string; doiTuong: string; doiTuongId: string; loai: string; tacGiaId: string };

export type KhaNangDuyet =
  | { duoc: true; buoc?: { projectId: string; buoc: string } }
  | { duoc: false; lyDo: string };

/**
 * Tin này còn chờ quyết không, và người này có quyền quyết không. Tin cũ (đã có
 * xin duyệt mới hơn, hoặc đã có người quyết) thì không hiện nút nữa — bấm vào đó
 * là quyết nhầm phiên bản.
 */
export async function khaNangDuyet(
  ai: Pick<SessionUser, "userId" | "role">,
  t: TinXin,
): Promise<KhaNangDuyet> {
  if (t.loai !== "XIN_DUYET") return { duoc: false, lyDo: "Tin này không phải xin duyệt." };
  if (t.tacGiaId === ai.userId) return { duoc: false, lyDo: "Không tự duyệt yêu cầu của chính mình." };

  const moiNhat = await db.traoDoi.findFirst({
    where: {
      doiTuong: t.doiTuong,
      doiTuongId: t.doiTuongId,
      loai: { in: ["XIN_DUYET", "CAN_SUA", "DONG_Y"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (moiNhat?.id !== t.id) return { duoc: false, lyDo: "Yêu cầu này đã được xử lý hoặc đã có yêu cầu mới hơn." };

  if (t.doiTuong === "BUOC") {
    const b = await db.buocQuyTrinh.findUnique({
      where: { id: t.doiTuongId },
      select: { projectId: true, buoc: true },
    });
    if (!b) return { duoc: false, lyDo: "Không tìm thấy bước." };
    const v = (await napQuyTrinh(b.projectId)).find((x) => x.buoc === b.buoc);
    if (v?.trangThai !== "CHO_DUYET") return { duoc: false, lyDo: "Bước không còn chờ duyệt." };
    if (!duocDuyetBuoc(ai, v)) return { duoc: false, lyDo: "Bạn không được chỉ định duyệt bước này." };
    return { duoc: true, buoc: b };
  }

  if (t.doiTuong === "CLIENT_QUOTE" || t.doiTuong === "QUOTE") {
    return (await duocDuyet(ai))
      ? { duoc: true }
      : { duoc: false, lyDo: "Chỉ Quản trị hoặc người được Quản trị giao mới duyệt được." };
  }
  return { duoc: false, lyDo: "Loại việc này chưa duyệt nhanh được." };
}
