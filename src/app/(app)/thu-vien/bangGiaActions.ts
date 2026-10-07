"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { docFileBangGia } from "@/lib/thuVien/bangGiaExcel";
import { soSanhBangGia, type DongBangGia, type KetQuaSoSanh } from "@/lib/thuVien/bangGia";
import { bangGiaChung } from "@/lib/thuVien/bangGiaDb";

const KHONG_CO_QUYEN = "Chỉ quản trị viên được sửa thư viện đơn giá.";

type KetQua<T> = ({ ok: true } & T) | { ok: false; error: string };

function dauNgay(s: string): Date | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function soVoiHienTai(dong: DongBangGia[], ngay: Date): Promise<KetQuaSoSanh> {
  const bang = await bangGiaChung(ngay);
  return soSanhBangGia(dong, new Map(bang.map((b) => [b.ma, b.gia])));
}

/**
 * Đọc file Excel đã sửa và trả về danh sách thay đổi để xem trước — CHƯA ghi gì.
 * Nhận đúng khuôn file tải về: tìm dòng tiêu đề có cột "Mã", đọc các cột theo tên.
 */
export async function xemTruocExcelBangGia(
  form: FormData
): Promise<KetQua<{ dong: DongBangGia[]; soSanh: KetQuaSoSanh }>> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Chưa chọn file." };
  const ngay = dauNgay(String(form.get("hieuLucTu") ?? ""));
  if (!ngay) return { ok: false, error: "Ngày hiệu lực không hợp lệ." };

  const doc = await docFileBangGia(await file.arrayBuffer());
  if (!doc.ok) return doc;
  const dong = doc.dong;
  return { ok: true, dong, soSanh: await soVoiHienTai(dong, ngay) };
}

/**
 * Ghi một phiên bản giá cho nhiều mã cùng lúc, cùng một ngày hiệu lực.
 *
 * Chỉ mã thực sự đổi mới sinh bản giá. Nếu đã có bản giá chung đúng ngày đó (ví dụ
 * cập nhật hai lần trong ngày) thì sửa bản đó thay vì báo trùng — với cả bảng, bắt
 * người dùng đi xoá từng bản cũ là vô lý.
 */
export async function capNhatBangGia(input: {
  dong: DongBangGia[];
  hieuLucTu: string;
  ghiChu: string;
  nguon: "NHAP_TAY" | "IMPORT_EXCEL";
}): Promise<KetQua<{ soMa: number; loi: string[] }>> {
  try {
    await requirePermission("thuVien", "edit");
  } catch {
    return { ok: false, error: KHONG_CO_QUYEN };
  }
  const ngay = dauNgay(input.hieuLucTu);
  if (!ngay) return { ok: false, error: "Ngày hiệu lực không hợp lệ." };

  const soSanh = await soVoiHienTai(input.dong, ngay);
  if (soSanh.thayDoi.length === 0)
    return { ok: false, error: "Không có mã nào đổi giá so với bảng hiện hành." };

  const session = await requireSession();
  const congTacs = await db.congTac.findMany({
    where: { ma: { in: soSanh.thayDoi.map((t) => t.ma) } },
    select: { id: true, ma: true },
  });
  const idTheoMa = new Map(congTacs.map((c) => [c.ma, c.id]));
  const ghiChu = input.ghiChu.trim() || `Cập nhật bảng giá ngày ${ngay.toLocaleDateString("vi-VN")}`;

  await db.$transaction(async (tx) => {
    for (const t of soSanh.thayDoi) {
      const congTacId = idTheoMa.get(t.ma)!;
      const data = {
        vatTu: t.moi.vatTu,
        nhanCongMay: t.moi.nhanCongMay,
        heSo: t.moi.heSo,
        donGia: t.moi.donGia,
        nguon: input.nguon,
        ghiChu,
      };
      const cungNgay = await tx.donGiaCongTac.findFirst({
        where: { congTacId, congTacVatTuId: null, khuVucId: null, hieuLucTu: ngay },
        select: { id: true },
      });
      if (cungNgay) {
        await tx.donGiaCongTac.update({ where: { id: cungNgay.id }, data });
      } else {
        await tx.donGiaCongTac.create({
          data: {
            ...data,
            congTacId,
            hieuLucTu: ngay,
            createdById: session.userId,
            createdByName: session.name,
          },
        });
      }
    }
  });

  await recordAudit({
    actor: session,
    entity: "DonGiaCongTac",
    entityId: "bang-gia",
    entityLabel: `Bảng giá ${ngay.toLocaleDateString("vi-VN")}`,
    action: "UPDATE",
    changes: Object.fromEntries(
      soSanh.thayDoi.map((t) => [t.ma, { truoc: t.cu?.donGia ?? null, sau: t.moi.donGia }])
    ),
  });

  revalidatePath("/thu-vien");
  return { ok: true, soMa: soSanh.thayDoi.length, loi: soSanh.loi };
}
