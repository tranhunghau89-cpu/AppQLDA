// Cộng mục con của một đầu việc dự toán thi công lên dòng cha (logic thuần).

export type LoaiMucCon = "DU_TOAN" | "THUC_TE";

export interface MucCon {
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  donGia: number | null;
}

export interface TongMucCon {
  /** Tổng khối lượng — null khi mục con khác đơn vị dòng cha (bulong tính cái, cha tính kg). */
  khoiLuong: number | null;
  /** Tổng thành tiền các mục con có đủ KL và đơn giá. Null = chưa mục nào có giá. */
  thanhTien: number | null;
  /** Đơn giá bình quân = thành tiền ÷ khối lượng, khi cộng được khối lượng. */
  donGia: number | null;
  /** Số mục con thiếu KL hoặc đơn giá — không vào thành tiền. */
  soThieu: number;
}

const chuan = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export function tongMucCon(ds: MucCon[], donViCha: string | null): TongMucCon {
  let thanhTien: number | null = null;
  let soThieu = 0;
  let kl = 0;
  let cungDonVi = ds.length > 0;
  for (const m of ds) {
    if (m.khoiLuong != null && m.donGia != null) {
      thanhTien = (thanhTien ?? 0) + m.khoiLuong * m.donGia;
    } else soThieu++;
    // Mục con không ghi đơn vị thì hiểu là cùng đơn vị dòng cha.
    if (m.khoiLuong == null || (m.donVi && chuan(m.donVi) !== chuan(donViCha))) cungDonVi = false;
    else kl += m.khoiLuong;
  }
  const khoiLuong = cungDonVi ? kl : null;
  return {
    khoiLuong,
    thanhTien,
    donGia: khoiLuong && thanhTien != null ? thanhTien / khoiLuong : null,
    soThieu,
  };
}
