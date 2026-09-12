"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { duocDungKhachHang } from "@/lib/crmScope";
import { recordAudit } from "@/lib/audit";
import { thongTinNguoiLap } from "@/lib/nguoiLapBaoGia";
import { docYeuCau, tieuDeCuoi, type OForm } from "@/lib/lapBaoGiaNhanh";
import { taoMoiKemMacDinh } from "../projects/[id]/client-quote/taoBaoGia";

export type LapNhanhResult =
  | { ok: true; coHoiId: string; clientQuoteId: string }
  | { ok: false; error: string };

const s = (form: FormData, key: string) => String(form.get(key) ?? "");

function fields(form: FormData): OForm {
  return {
    khachMode: s(form, "khachMode"),
    khachHangId: s(form, "khachHangId"),
    khachTen: s(form, "khachTen"),
    khachNguoiLienHe: s(form, "khachNguoiLienHe"),
    khachPhone: s(form, "khachPhone"),
    coHoiMode: s(form, "coHoiMode"),
    coHoiId: s(form, "coHoiId"),
    coHoiTen: s(form, "coHoiTen"),
    coHoiDiaDiem: s(form, "coHoiDiaDiem"),
    coHoiBuildingType: s(form, "coHoiBuildingType"),
    coHoiArea: s(form, "coHoiArea"),
    title: s(form, "title"),
    templateId: s(form, "templateId"),
  };
}

/**
 * Lập một bản báo giá gửi khách ngay từ danh sách, dựng hộ khách và công trình nếu
 * chúng chưa có.
 *
 * Đường dài vẫn còn nguyên bên CRM; đây chỉ là lối tắt cho lúc đang nói chuyện với
 * khách. Kết quả giống hệt: vẫn là một khách, một công trình chào giá, một bản báo giá
 * — không sinh ra loại bản ghi nào khác.
 */
export async function lapBaoGiaNhanh(form: FormData): Promise<LapNhanhResult> {
  let actor;
  try {
    actor = await requirePermission("quote", "edit");
  } catch {
    return { ok: false, error: "Bạn không có quyền lập báo giá." };
  }

  const doc = docYeuCau(fields(form));
  if (!doc.ok) return { ok: false, error: doc.loi };
  const { khach, coHoi, templateId } = doc.yeuCau;

  // Dựng khách hoặc công trình là ghi vào CRM — hỏi quyền đó riêng, đừng để quyền báo
  // giá kéo theo.
  const phaiTaoMoi = khach.loai === "MOI" || coHoi.loai === "MOI";
  if (phaiTaoMoi && !can(actor.role as Role, "customer", "edit")) {
    return { ok: false, error: "Bạn không có quyền tạo khách hàng / công trình mới." };
  }

  // --- Khách ---
  let khachHangId: string;
  let tenKhach: string;
  if (khach.loai === "CO_SAN") {
    const kh = await db.khachHang.findUnique({
      where: { id: khach.id },
      select: { id: true, tenCty: true, ownerId: true },
    });
    if (!kh) return { ok: false, error: "Không tìm thấy khách hàng." };
    if (!duocDungKhachHang(actor, kh.ownerId)) {
      return { ok: false, error: "Khách này do người khác phụ trách." };
    }
    khachHangId = kh.id;
    tenKhach = kh.tenCty;
  } else {
    // Người dựng tự phụ trách — giống hệt luật ở khu Khách hàng.
    const kh = await db.khachHang.create({
      data: {
        tenCty: khach.tenCty,
        nguoiLienHe: khach.nguoiLienHe,
        phone: khach.phone,
        ownerId: actor.userId,
        ownerName: actor.name,
      },
    });
    khachHangId = kh.id;
    tenKhach = kh.tenCty;
  }

  // --- Công trình ---
  let coHoiId: string;
  let tenCongTrinh: string;
  if (coHoi.loai === "CO_SAN") {
    const ch = await db.coHoi.findUnique({
      where: { id: coHoi.id },
      select: { id: true, tenCongTrinh: true, khachHangId: true, projectId: true },
    });
    if (!ch) return { ok: false, error: "Không tìm thấy công trình." };
    // `coHoiId` đến từ trình duyệt, độc lập với `khachHangId` — phải đối chiếu, nếu
    // không thì chọn khách của mình rồi gắn công trình của người khác là xong.
    if (ch.khachHangId !== khachHangId) {
      return { ok: false, error: "Công trình không thuộc khách hàng đã chọn." };
    }
    if (ch.projectId) {
      return {
        ok: false,
        error: "Công trình này đã thành dự án — lập báo giá ở trang dự án.",
      };
    }
    coHoiId = ch.id;
    tenCongTrinh = ch.tenCongTrinh;
  } else {
    const ch = await db.coHoi.create({
      data: {
        khachHangId,
        tenCongTrinh: coHoi.tenCongTrinh,
        diaDiem: coHoi.diaDiem,
        buildingType: coHoi.buildingType,
        area: coHoi.area,
        trangThai: "DANG_CHAO",
      },
    });
    coHoiId = ch.id;
    tenCongTrinh = ch.tenCongTrinh;
  }

  // --- Báo giá ---
  const title = tieuDeCuoi(doc.yeuCau.title, tenCongTrinh);
  const clientQuoteId = await taoMoiKemMacDinh(
    { loai: "CO_HOI", id: coHoiId },
    {
      title,
      // Chụp lại tên khách làm "Kính gửi" — bản in không đổi khi khách đổi tên sau này.
      recipient: tenKhach,
      location: coHoi.loai === "MOI" ? coHoi.diaDiem : null,
      scope: "Kết cấu thép và bao che",
      quoteDate: new Date(),
      ...(await thongTinNguoiLap(actor)),
    },
    templateId
  );

  await recordAudit({
    actor: await requireSession(),
    entity: "ClientQuote",
    entityId: clientQuoteId,
    entityLabel: title,
    projectId: null,
    action: "CREATE",
    changes: null,
  });

  revalidatePath("/client-quotes");
  revalidatePath("/khach-hang");
  return { ok: true, coHoiId, clientQuoteId };
}
