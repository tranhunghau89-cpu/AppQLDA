import "server-only";

import { db } from "@/lib/db";
import { monDonHangThanhMucCon, type MonDonHang, type MucCon } from "@/lib/khoiLuong/mucCon";
import { laDonViDem, traKgMotDonVi, type MauKg } from "@/lib/thuVien/trongLuongBulong";

/** Công tác thư viện đã khai kg một đơn vị — bảng quy đổi bộ → kg. */
export async function napThuVienKg(): Promise<MauKg[]> {
  const ds = await db.congTac.findMany({
    where: { khoiLuongDonVi: { not: null }, active: true },
    select: { ten: true, quyCach: true, khoiLuongDonVi: true },
  });
  return ds.map((c) => ({ ten: c.ten, quyCach: c.quyCach, khoiLuongDonVi: c.khoiLuongDonVi! }));
}

/**
 * Món đơn hàng thành mục con, kèm kg: cột trọng lượng của món thắng; món tính bộ/cái mà
 * chưa ghi trọng lượng thì tra bảng quy đổi (thư viện, rồi công thức).
 */
export function monDonHangCoKg(m: MonDonHang, thuVien: readonly MauKg[]): MucCon {
  const mc = monDonHangThanhMucCon(m);
  if (mc.kgTong == null && laDonViDem(m.unit)) {
    mc.kgMotDonVi = traKgMotDonVi(m.name, thuVien)?.kg ?? null;
  }
  return mc;
}
