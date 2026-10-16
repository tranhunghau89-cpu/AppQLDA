import "server-only";

import { db } from "@/lib/db";
import { tongMucCon, type LoaiMucCon } from "@/lib/khoiLuong/mucCon";
import { monDonHangCoKg, napThuVienKg } from "@/lib/khoiLuong/thuVienKg";

/**
 * Cộng mục con lên dòng cha và GHI tổng vào dòng cha, để mọi chỗ cộng tiền khác
 * (`computeAmount`, `computeActualAmount`, xuất Excel, bảng giai đoạn) không phải biết
 * tới bảng mục con.
 *
 * DỰ TOÁN: không còn mục con thì để nguyên số cuối cùng (như gỡ bảng bóc). Có thì thành
 * tiền = tổng mục con; KL = tổng KL khi cùng đơn vị — khác đơn vị (bulong tính cái, cha
 * tính kg) hoặc đã có bảng bóc thì giữ KL của cha; đơn giá = thành tiền ÷ KL.
 *
 * THỰC TẾ: mục con thực tế + các món đơn hàng mua đã gắn vào đầu việc. Người dùng đã gõ
 * tay ô thực tế trên dòng cha (`thucTeGhiDe`) thì không đụng.
 */
export async function tinhLaiTuMucCon(itemId: string, loai: LoaiMucCon) {
  const cha = await db.estimateItem.findUnique({
    where: { id: itemId },
    select: {
      unit: true,
      designQty: true,
      thucTeGhiDe: true,
      _count: { select: { chiTiet: true } },
      mucCon: {
        where: { loai },
        select: { ten: true, donVi: true, khoiLuong: true, donGia: true, kgMotDonVi: true },
      },
      donHang:
        loai === "THUC_TE"
          ? { select: { name: true, unit: true, qty: true, unitPrice: true, amount: true, weight: true } }
          : false,
    },
  });
  if (!cha) return;
  const thuVien = cha.unit?.trim().toLowerCase() === "kg" ? await napThuVienKg() : [];
  const ds = [...cha.mucCon, ...(cha.donHang ?? []).map((m) => monDonHangCoKg(m, thuVien))];
  const t = tongMucCon(ds, cha.unit);

  if (loai === "DU_TOAN") {
    if (cha.mucCon.length === 0) return;
    const kl = cha._count.chiTiet > 0 ? cha.designQty : (t.khoiLuong ?? cha.designQty);
    await db.estimateItem.update({
      where: { id: itemId },
      data: {
        designQty: kl,
        amount: t.thanhTien,
        unitPrice: kl && t.thanhTien != null ? t.thanhTien / kl : null,
      },
    });
    return;
  }

  if (cha.thucTeGhiDe) return;
  await db.estimateItem.update({
    where: { id: itemId },
    data:
      ds.length === 0
        ? { actualQty: null, actualUnitPrice: null, actualAmount: null }
        : { actualQty: t.khoiLuong, actualUnitPrice: t.donGia, actualAmount: t.thanhTien },
  });
}

/** Tính lại phía thực tế cho các đầu việc (bỏ trùng, bỏ null) — sau khi gắn / sửa / xoá món đơn hàng. */
export async function tinhLaiThucTe(ids: (string | null | undefined)[]) {
  for (const id of new Set(ids.filter((x): x is string => !!x))) {
    await tinhLaiTuMucCon(id, "THUC_TE");
  }
}
