import "server-only";

import { db } from "@/lib/db";
import { tinhKhoiLuongDanXuat } from "@/lib/thuVien/danXuat";
import { tinhCongThucDong } from "@/lib/khoiLuong/congThucDong";

/**
 * Tính lại khối lượng các dòng TỰ TÍNH của dự toán thi công một dự án và GHI vào dòng.
 *
 * Hai loại dòng tự tính:
 *  - DẪN XUẤT, cùng luật với dự toán chào giá (`tinhKhoiLuongDanXuat`): dòng nguồn mang
 *    `napThamSo` ("KCT_KG", "TON_M2"…), dòng đích mang `layTuThamSo` cùng tên; KL đích =
 *    tổng KL nguồn TRONG CÙNG HẠNG MỤC × hệ số. Vận chuyển KCT của Vách lấy đúng kg thép
 *    của Vách, không phải của cả nhà.
 *  - CÔNG THỨC THAM CHIẾU DÒNG (`klCongThuc`): "Lắp phụ kiện" = [6.1]+[7.1]+[8.1].
 *
 * Hai loại có thể dựa vào nhau (công thức lấy KL một dòng dẫn xuất, dòng nguồn của dẫn
 * xuất lại là một công thức), nên tính lặp tới khi ổn định. Vòng tham chiếu đã bị chặn lúc
 * lưu; giới hạn số vòng ở đây chỉ là chốt an toàn.
 *
 * Hạng mục thi công phẳng (không có cha), nên mỗi hạng mục là một "phần gốc". Dòng chưa
 * phân hạng mục gom chung một nhóm.
 *
 * Ghi chứ không chỉ tính lúc hiển thị: tổng dự toán, so sánh dự án, xuất Excel, bảng
 * lợi nhuận đều đọc thẳng `designQty`/`amount`, và bắt từng chỗ ấy tự tính lại là để
 * sớm muộn một chỗ quên.
 *
 * Dòng đích đã có bảng bóc hoặc mục con dự toán thì KHÔNG đụng — người dùng đã chọn bóc
 * khối lượng riêng cho nó. Chưa dòng nguồn nào có KL thì cũng để nguyên số cũ.
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
      klCongThuc: true,
      _count: { select: { chiTiet: true, mucCon: { where: { loai: "DU_TOAN" } } } },
    },
  });
  if (!ds.some((d) => d.layTuThamSo || d.klCongThuc)) return 0;

  const tuQuanKL = (d: (typeof ds)[number]) => d._count.chiTiet > 0 || d._count.mucCon > 0;
  const kl = new Map<string, number | null>(ds.map((d) => [d.id, d.designQty]));
  const lamTron = (v: number) => Math.round(v * 1000) / 1000;

  for (let vong = 0; vong < 10; vong++) {
    let doi = false;
    const danXuat = tinhKhoiLuongDanXuat(
      ds.map((d) => ({
        id: d.id,
        sectionId: d.sectionId ?? "_",
        qty: kl.get(d.id) ?? null,
        napThamSo: d.napThamSo,
        layTuThamSo: d.layTuThamSo,
        heSoQuyDoi: d.heSoQuyDoi,
      })),
      []
    );
    for (const d of ds) {
      if (tuQuanKL(d)) continue;
      let moi: number | null = null;
      if (d.klCongThuc) moi = tinhCongThucDong(d.klCongThuc, kl);
      else if (d.layTuThamSo) moi = danXuat.get(d.id)?.khoiLuong ?? null;
      else continue;
      if (moi == null) continue;
      moi = lamTron(moi);
      const cu = kl.get(d.id);
      if (cu == null || Math.abs(cu - moi) > 1e-6) {
        kl.set(d.id, moi);
        doi = true;
      }
    }
    if (!doi) break;
  }

  let soDong = 0;
  for (const d of ds) {
    const moi = kl.get(d.id);
    if (moi == null || (d.designQty != null && Math.abs(d.designQty - moi) < 1e-6)) continue;
    await db.estimateItem.update({
      where: { id: d.id },
      data: { designQty: moi, amount: d.unitPrice != null ? moi * d.unitPrice : null },
    });
    soDong++;
  }
  return soDong;
}
