import "server-only";

import { db } from "@/lib/db";
import { tinhKhoiLuongDanXuat } from "@/lib/thuVien/danXuat";

/**
 * Tính lại khối lượng các dòng DẪN XUẤT của dự toán thi công một dự án và GHI vào dòng.
 *
 * Cùng luật với dự toán chào giá (`tinhKhoiLuongDanXuat`): dòng nguồn mang `napThamSo`
 * ("KCT_KG", "TON_M2"…), dòng đích mang `layTuThamSo` cùng tên; KL đích = tổng KL nguồn
 * TRONG CÙNG HẠNG MỤC × hệ số. Vận chuyển KCT, Lắp dựng KCT của hạng mục Vách lấy đúng
 * số kg thép của Vách, không phải của cả nhà.
 *
 * Hạng mục thi công phẳng (không có cha), nên mỗi hạng mục là một "phần gốc". Dòng chưa
 * phân hạng mục gom chung một nhóm.
 *
 * Ghi chứ không chỉ tính lúc hiển thị: tổng dự toán, so sánh dự án, xuất Excel, bảng
 * lợi nhuận đều đọc thẳng `designQty`/`amount`, và bắt từng chỗ ấy tự tính lại là để
 * sớm muộn một chỗ quên.
 *
 * Dòng đích đã có bảng bóc hoặc mục con dự toán thì KHÔNG đụng — người dùng đã chọn bóc
 * khối lượng riêng cho nó. Chưa dòng nguồn nào có KL thì cũng để nguyên số cũ, không
 * xoá trắng.
 */
export async function tinhLaiDanXuatThiCong(projectId: string): Promise<number> {
  const ds = await db.estimateItem.findMany({
    where: { projectId },
    select: {
      id: true,
      sectionId: true,
      designQty: true,
      unitPrice: true,
      napThamSo: true,
      layTuThamSo: true,
      heSoQuyDoi: true,
      _count: { select: { chiTiet: true, mucCon: { where: { loai: "DU_TOAN" } } } },
    },
  });
  if (!ds.some((d) => d.layTuThamSo)) return 0;

  const kq = tinhKhoiLuongDanXuat(
    ds.map((d) => ({
      id: d.id,
      sectionId: d.sectionId ?? "_",
      qty: d.designQty,
      napThamSo: d.napThamSo,
      layTuThamSo: d.layTuThamSo,
      heSoQuyDoi: d.heSoQuyDoi,
    })),
    []
  );

  let soDong = 0;
  for (const d of ds) {
    const t = kq.get(d.id);
    if (!t || t.khoiLuong == null) continue;
    if (d._count.chiTiet > 0 || d._count.mucCon > 0) continue;
    const kl = Math.round(t.khoiLuong * 1000) / 1000;
    if (d.designQty != null && Math.abs(d.designQty - kl) < 1e-6) continue;
    await db.estimateItem.update({
      where: { id: d.id },
      data: { designQty: kl, amount: d.unitPrice != null ? kl * d.unitPrice : null },
    });
    soDong++;
  }
  return soDong;
}
