// Cộng mục con của một đầu việc dự toán thi công lên dòng cha (logic thuần).

export type LoaiMucCon = "DU_TOAN" | "THUC_TE";

export interface MucCon {
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  donGia: number | null;
  /** Thành tiền chốt sẵn (món đơn hàng có ô thành tiền) — có thì dùng thay KL × đơn giá. */
  thanhTien?: number | null;
  /** Kg một đơn vị — quy bộ/cái ra kg khi đầu việc tính theo kg. */
  kgMotDonVi?: number | null;
  /** Tổng kg chốt sẵn (cột trọng lượng của món đơn hàng) — thắng kgMotDonVi. */
  kgTong?: number | null;
}

/** Một món đơn hàng mua đã gắn vào đầu việc — tính như một mục con thực tế. */
export interface MonDonHang {
  name: string;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  /** Trọng lượng (kg) ghi trên món đơn hàng. */
  weight?: number | null;
}

export function monDonHangThanhMucCon(m: MonDonHang): MucCon {
  const thanhTien = m.amount ?? (m.qty != null && m.unitPrice != null ? m.qty * m.unitPrice : null);
  return {
    ten: m.name,
    donVi: m.unit,
    khoiLuong: m.qty,
    donGia: m.unitPrice ?? (thanhTien != null && m.qty ? thanhTien / m.qty : null),
    thanhTien,
    kgTong: m.weight ?? null,
  };
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

/**
 * Khối lượng mục con tính theo ĐƠN VỊ CỦA ĐẦU VIỆC. Cùng đơn vị (hoặc mục con không ghi
 * đơn vị) thì giữ nguyên; đầu việc tính kg mà mục con tính bộ/cái thì quy ra kg bằng
 * trọng lượng (tổng kg chốt sẵn, hoặc KL × kg một đơn vị). Không quy được → null.
 */
export function khoiLuongTheoCha(m: MucCon, donViCha: string | null): number | null {
  if (!m.donVi || chuan(m.donVi) === chuan(donViCha)) return m.khoiLuong;
  if (chuan(donViCha) !== "kg") return null;
  if (m.kgTong != null) return m.kgTong;
  if (m.khoiLuong != null && m.kgMotDonVi != null) return m.khoiLuong * m.kgMotDonVi;
  return null;
}

export function tongMucCon(ds: MucCon[], donViCha: string | null): TongMucCon {
  let thanhTien: number | null = null;
  let soThieu = 0;
  let kl = 0;
  let cungDonVi = ds.length > 0;
  for (const m of ds) {
    const tien =
      m.thanhTien ?? (m.khoiLuong != null && m.donGia != null ? m.khoiLuong * m.donGia : null);
    if (tien != null) thanhTien = (thanhTien ?? 0) + tien;
    else soThieu++;
    // Mục con không ghi đơn vị thì hiểu là cùng đơn vị dòng cha; bộ/cái quy ra kg khi có trọng lượng.
    const klCha = khoiLuongTheoCha(m, donViCha);
    if (klCha == null) cungDonVi = false;
    else kl += klCha;
  }
  const khoiLuong = cungDonVi ? kl : null;
  return {
    khoiLuong,
    thanhTien,
    donGia: khoiLuong && thanhTien != null ? thanhTien / khoiLuong : null,
    soThieu,
  };
}
