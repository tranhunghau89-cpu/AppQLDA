// Chia dòng công tác thành NHÓM theo kiểu dự toán thi công — logic THUẦN.
//
// Bảng giá vốn của báo giá gửi khách và bảng dự toán thi công phải đọc giống nhau:
// "Vật tư · Vận chuyển · Lắp đặt · Mã dưỡng" chỉ có nghĩa khi đứng dưới "Bulong neo".
// Tên gọn không kèm nhóm là một danh sách chữ mà người đọc phải tự đoán.

import { ESTIMATE_GROUP_MAP } from "./constants";

/** Nhóm của những dòng không nói được mình thuộc nhóm nào. */
export const NHAN_NHOM_KHAC = "Khác";

/**
 * Nhãn nhóm của một dòng dự toán chào giá.
 *
 * Thứ tự ưu tiên, từ cụ thể tới chung:
 *   1. Nhóm ghi trên chính dòng (áp từ bộ hạng mục, hoặc người lập tự gõ).
 *   2. Tên mục con chứa dòng — bản dự toán dựng tay hay chia nhóm bằng mục con.
 *   3. Nhóm chi phí của công tác trong thư viện ("Kết cấu thép").
 * Không có gì cả thì null — người gọi quyết định gom vào đâu.
 */
export function nhanNhomDongBaoGia(d: {
  groupLabel: string | null;
  tenMucCon: string | null;
  nhomChiPhi: string | null;
}): string | null {
  return (
    d.groupLabel?.trim() ||
    d.tenMucCon?.trim() ||
    (d.nhomChiPhi ? (ESTIMATE_GROUP_MAP[d.nhomChiPhi]?.label ?? null) : null)
  );
}

export interface NhomDong<T> {
  /** null = cả danh sách không dòng nào có nhóm; hiện phẳng, không tiêu đề nhóm. */
  nhan: string | null;
  dong: T[];
}

/**
 * Gom dòng theo nhãn nhóm, GIỮ thứ tự xuất hiện đầu tiên của từng nhóm.
 *
 * Không xếp nhóm theo bảng chữ cái: thứ tự dòng là thứ tự người lập (hoặc bộ hạng mục)
 * đã dựng — bulong neo trước, kết cấu thép sau — và bảng phải đọc theo đúng nhịp đó.
 * Cùng luật với bảng dự toán thi công.
 *
 * Dòng thiếu nhóm nằm trong nhóm "Khác" (gộp với nhóm "Khác" nếu đã có). Riêng khi
 * KHÔNG dòng nào có nhóm thì trả một nhóm nhãn null: một tiêu đề "Khác" trùm lên cả
 * bảng chỉ là thêm một hàng chữ vô nghĩa.
 */
export function gomNhomTheoThuTu<T>(
  dong: readonly T[],
  nhanCua: (d: T) => string | null
): NhomDong<T>[] {
  if (dong.length === 0) return [];
  const nhan = dong.map((d) => nhanCua(d)?.trim() || null);
  if (nhan.every((n) => n === null)) return [{ nhan: null, dong: [...dong] }];

  const theoNhan = new Map<string, T[]>();
  dong.forEach((d, i) => {
    const k = nhan[i] ?? NHAN_NHOM_KHAC;
    const ds = theoNhan.get(k);
    if (ds) ds.push(d);
    else theoNhan.set(k, [d]);
  });
  // Map giữ thứ tự chèn, nên đây chính là thứ tự xuất hiện đầu tiên.
  return [...theoNhan].map(([n, ds]) => ({ nhan: n, dong: ds }));
}

export interface ChiSoNhom {
  /** Phần của nhóm trong tổng giá vốn của hạng mục (0..1); null khi hạng mục chưa có vốn. */
  tyLe: number | null;
  /** Tiền của nhóm chia cho diện tích hạng mục; null khi hạng mục chưa khai diện tích. */
  moiM2: number | null;
}

/**
 * Hai chỉ số của một nhóm trong hạng mục: đơn giá trên m² và tỉ trọng chi phí.
 *
 * Mẫu số m² là diện tích của HẠNG MỤC chứa nhóm, không phải của nhóm — "bulong neo tốn
 * 8.000 đ trên mỗi m² mái" là con số người lập dùng để so giữa các công trình.
 *
 * Mẫu số thiếu hoặc ≤ 0 thì trả null chứ không trả 0 hay Infinity: bảng hiện gạch, và
 * không ai định giá bán dựa trên một con số chia cho không.
 */
export function chiSoNhom(tienNhom: number, tienHangMuc: number, dienTich: number | null): ChiSoNhom {
  return {
    tyLe: tienHangMuc > 0 ? tienNhom / tienHangMuc : null,
    moiM2: dienTich != null && dienTich > 0 ? tienNhom / dienTich : null,
  };
}
