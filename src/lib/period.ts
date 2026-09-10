// Báo cáo theo kỳ (tháng / quý / năm) — phần THUẦN: xác định khoảng thời gian và
// cộng dồn số liệu. Phần lấy dữ liệu từ DB nằm ở app/(app)/reports/page.tsx.

export type LoaiKy = "thang" | "quy" | "nam";

export interface Ky {
  loai: LoaiKy;
  nam: number;
  /** 1–12 với tháng, 1–4 với quý, bỏ qua với năm. */
  so: number;
}

/**
 * Múi giờ Việt Nam, tính bằng giờ so với UTC.
 *
 * Đây là chỗ dễ sai NHẤT của cả mục này. Máy chủ trên Vercel chạy theo UTC, nên nếu
 * lấy mốc kỳ bằng `new Date(nam, thang, 1)` thì ranh giới tháng rơi vào 00:00 UTC =
 * 07:00 sáng giờ Việt Nam. Hậu quả: một khoản thu ghi ngày 01/09 giờ Việt Nam sẽ bị
 * đếm sang tháng 8. Sai một khoản ở đúng ranh giới tháng là loại lỗi không ai phát
 * hiện ra cho tới lúc đối chiếu sổ sách.
 */
const MUI_GIO_VN = 7;

/** Nửa đêm giờ Việt Nam của một ngày, biểu diễn dưới dạng thời điểm UTC. */
function nuaDemVN(nam: number, thangTu0: number, ngay: number): Date {
  return new Date(Date.UTC(nam, thangTu0, ngay, -MUI_GIO_VN, 0, 0, 0));
}

/** Khoảng của kỳ, nửa mở: `tu <= x < den`. */
export function khoangKy(ky: Ky): { tu: Date; den: Date } {
  if (ky.loai === "nam") {
    return { tu: nuaDemVN(ky.nam, 0, 1), den: nuaDemVN(ky.nam + 1, 0, 1) };
  }
  if (ky.loai === "quy") {
    const dau = (ky.so - 1) * 3;
    return { tu: nuaDemVN(ky.nam, dau, 1), den: nuaDemVN(ky.nam, dau + 3, 1) };
  }
  return { tu: nuaDemVN(ky.nam, ky.so - 1, 1), den: nuaDemVN(ky.nam, ky.so, 1) };
}

export function nhanKy(ky: Ky): string {
  if (ky.loai === "nam") return `Năm ${ky.nam}`;
  if (ky.loai === "quy") return `Quý ${ky.so}/${ky.nam}`;
  return `Tháng ${ky.so}/${ky.nam}`;
}

/** Mã kỳ dùng trên thanh địa chỉ: `2026-09`, `2026-Q3`, `2026`. */
export function maKy(ky: Ky): string {
  if (ky.loai === "nam") return String(ky.nam);
  if (ky.loai === "quy") return `${ky.nam}-Q${ky.so}`;
  return `${ky.nam}-${String(ky.so).padStart(2, "0")}`;
}

/** Đọc mã kỳ từ thanh địa chỉ. Trả `null` nếu không hợp lệ — người dùng sửa được URL. */
export function docMaKy(s: string | null | undefined): Ky | null {
  if (!s) return null;
  let m = s.match(/^(\d{4})-Q([1-4])$/i);
  if (m) return { loai: "quy", nam: Number(m[1]), so: Number(m[2]) };
  m = s.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (m) return { loai: "thang", nam: Number(m[1]), so: Number(m[2]) };
  m = s.match(/^(\d{4})$/);
  if (m) return { loai: "nam", nam: Number(m[1]), so: 0 };
  return null;
}

/** Kỳ liền trước, để so sánh tăng/giảm. */
export function kyTruoc(ky: Ky): Ky {
  if (ky.loai === "nam") return { loai: "nam", nam: ky.nam - 1, so: 0 };
  if (ky.loai === "quy") {
    return ky.so === 1
      ? { loai: "quy", nam: ky.nam - 1, so: 4 }
      : { loai: "quy", nam: ky.nam, so: ky.so - 1 };
  }
  return ky.so === 1
    ? { loai: "thang", nam: ky.nam - 1, so: 12 }
    : { loai: "thang", nam: ky.nam, so: ky.so - 1 };
}

/** Kỳ chứa một thời điểm cho trước (theo lịch Việt Nam). */
export function kyChua(loai: LoaiKy, moc: Date): Ky {
  // Đẩy sang giờ Việt Nam rồi mới đọc tháng/năm, cùng lý do với `nuaDemVN`.
  const vn = new Date(moc.getTime() + MUI_GIO_VN * 3600_000);
  const nam = vn.getUTCFullYear();
  const thang = vn.getUTCMonth() + 1;
  if (loai === "nam") return { loai, nam, so: 0 };
  if (loai === "quy") return { loai, nam, so: Math.floor((thang - 1) / 3) + 1 };
  return { loai, nam, so: thang };
}

/** Vài kỳ gần nhất tính lùi từ `ky`, để dựng ô chọn kỳ. */
export function cacKyGanDay(ky: Ky, soLuong: number): Ky[] {
  const ra: Ky[] = [];
  let cur = ky;
  for (let i = 0; i < soLuong; i++) {
    ra.push(cur);
    cur = kyTruoc(cur);
  }
  return ra;
}

// ---------- Cộng dồn ----------

export interface Gop {
  so: number;
  tien: number;
}

const RONG: Gop = { so: 0, tien: 0 };

/** Đếm và cộng tiền các bản ghi có mốc thời gian rơi vào khoảng. */
export function gopTheoMoc<T>(
  rows: T[],
  moc: (r: T) => Date | null | undefined,
  tien: (r: T) => number | null | undefined,
  tu: Date,
  den: Date
): Gop {
  let so = 0;
  let tong = 0;
  for (const r of rows) {
    const d = moc(r);
    if (!d) continue;
    const t = d.getTime();
    // Nửa mở: mốc đúng bằng `den` thuộc về kỳ SAU, không đếm hai lần.
    if (t < tu.getTime() || t >= den.getTime()) continue;
    so++;
    tong += tien(r) ?? 0;
  }
  return { so, tien: tong };
}

export interface ThanhToanRow {
  direction: string;
  paidDate: Date | null;
  paidAmount: number | null;
  amount: number | null;
}

/**
 * Dòng tiền thực tế trong kỳ.
 *
 * Chỉ tính khoản đã có `paidDate` — báo cáo kỳ nói về tiền đã thực sự vào/ra, không
 * phải kế hoạch. Số tiền lấy `paidAmount`; nếu bỏ trống thì lùi về `amount` theo kế
 * hoạch, vì trong dữ liệu thật nhiều dòng chỉ đánh dấu đã trả mà không nhập lại số.
 */
export function dongTien(rows: ThanhToanRow[], tu: Date, den: Date): { vao: Gop; ra: Gop } {
  const soTien = (r: ThanhToanRow) => r.paidAmount ?? r.amount ?? 0;
  return {
    vao: gopTheoMoc(
      rows.filter((r) => r.direction === "THU"),
      (r) => r.paidDate,
      soTien,
      tu,
      den
    ),
    ra: gopTheoMoc(
      rows.filter((r) => r.direction === "CHI"),
      (r) => r.paidDate,
      soTien,
      tu,
      den
    ),
  };
}

export interface BaoCaoKy {
  ky: Ky;
  nhan: string;
  tu: Date;
  den: Date;
  tienVao: Gop;
  tienRa: Gop;
  /** Chênh lệch tiền vào − tiền ra trong kỳ. */
  dongTienRong: number;
  hopDongKy: Gop;
  donHang: Gop;
  duAnKhoiCong: Gop;
  duAnHoanThanh: Gop;
  mocHoanThanh: Gop;
}

export interface NguonBaoCao {
  thanhToan: ThanhToanRow[];
  hopDong: { signDate: Date | null; giaTri: number }[];
  donHang: { orderDate: Date | null; value: number | null }[];
  duAn: { startDate: Date | null; endDate: Date | null; salePrice: number | null }[];
  moc: { actualDate: Date | null }[];
}

/** Dựng báo cáo cho một kỳ. Hàm THUẦN. */
export function buildBaoCaoKy(nguon: NguonBaoCao, ky: Ky): BaoCaoKy {
  const { tu, den } = khoangKy(ky);
  const { vao, ra } = dongTien(nguon.thanhToan, tu, den);

  return {
    ky,
    nhan: nhanKy(ky),
    tu,
    den,
    tienVao: vao,
    tienRa: ra,
    dongTienRong: vao.tien - ra.tien,
    hopDongKy: gopTheoMoc(nguon.hopDong, (h) => h.signDate, (h) => h.giaTri, tu, den),
    donHang: gopTheoMoc(nguon.donHang, (d) => d.orderDate, (d) => d.value, tu, den),
    duAnKhoiCong: gopTheoMoc(nguon.duAn, (p) => p.startDate, (p) => p.salePrice, tu, den),
    duAnHoanThanh: gopTheoMoc(nguon.duAn, (p) => p.endDate, (p) => p.salePrice, tu, den),
    mocHoanThanh: gopTheoMoc(nguon.moc, (m) => m.actualDate, () => 0, tu, den),
  };
}

/**
 * Phần trăm thay đổi so với kỳ trước.
 *
 * Trả `null` khi kỳ trước bằng 0 — "tăng vô hạn phần trăm" là con số vô nghĩa, giao
 * diện hiện dấu gạch thay vì một số gây hiểu nhầm.
 */
export function phanTramDoi(nay: number, truoc: number): number | null {
  if (truoc === 0) return null;
  return ((nay - truoc) / Math.abs(truoc)) * 100;
}

export const KY_RONG: Gop = RONG;
