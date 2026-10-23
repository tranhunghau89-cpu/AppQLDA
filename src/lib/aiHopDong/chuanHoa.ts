// Chuyển kết quả AI (HopDongAi) thành bản nháp có đúng hình dạng của form hợp đồng.
// Hàm THUẦN. Màn duyệt sửa trên bản nháp này, rồi gửi nguyên nó lên để ghi — nên tên
// trường hợp đồng/hạng mục trùng với contractSchema / itemSchema.
import type { HopDongAi, TruongAi } from "./khuon";

export interface DongHangMucNhap {
  name: string;
  unit: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  /** Trang trong file gốc, để màn duyệt nhảy tới. */
  trang: number | null;
}

export interface DotThanhToanNhap {
  ten: string;
  phanTram: number | null;
  soTien: number | null;
  dieuKien: string;
}

export interface BanNhapHopDong {
  hopDong: {
    contractNo: string;
    signDate: string; // YYYY-MM-DD hoặc ""
    effectiveDate: string;
    durationDays: number | null;
    subject: string;
    partyAName: string;
    partyAInfo: string;
    status: string;
    vatPercent: number | null;
    paymentTerms: string;
    note: string;
  };
  hangMuc: DongHangMucNhap[];
  dotThanhToan: DotThanhToanNhap[];
  /**
   * Con số GHI TRÊN hợp đồng. Không lưu vào Contract (giá trị HĐ luôn tính lại từ hạng
   * mục) — chỉ để đối chiếu xem hạng mục AI đọc có cộng ra đúng tổng không.
   */
  doiChieu: {
    giaTriTruocVat: number | null;
    giaTriSauVat: number | null;
    giaTriBangChu: string | null;
    tenBenB: string | null;
  };
  /** HĐ không có bảng hạng mục: đã tự tạo một dòng khoán bằng giá trị trước VAT. */
  hangMucTuDong: boolean;
  /** Khoá trường (như ở trên) mà AI tự đánh giá độ tin cậy thấp. */
  tinCayThap: string[];
  /** Ngày AI trả về nhưng không đọc được thành ngày hợp lệ. */
  ngayKhongHopLe: string[];
  /** Câu nguyên văn + trang cho từng khoá trường. */
  bangChung: Record<string, { trichDan: string | null; trang: number | null }>;
  ghiChuAi: string | null;
}

/**
 * "2026-04-07", "07/04/2026", "7-4-2026", "07.04.2026" → "2026-04-07".
 * Ngày không có thật (31/02) → null. Hợp đồng VN viết ngày/tháng/năm, không bao giờ
 * tháng/ngày, nên không đoán kiểu Mỹ.
 */
export function chuanHoaNgay(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let y: number, m: number, d: number;
  let k = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (k) {
    [y, m, d] = [Number(k[1]), Number(k[2]), Number(k[3])];
  } else {
    k = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
    if (!k) return null;
    [d, m, y] = [Number(k[1]), Number(k[2]), Number(k[3])];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Địa chỉ, MST, người đại diện của Bên A gộp thành ô "partyAInfo", mỗi thứ một dòng. */
export function ghepThongTinBenA(benA: HopDongAi["benA"]): string {
  const dong: string[] = [];
  if (benA.diaChi.giaTri) dong.push(`Địa chỉ: ${benA.diaChi.giaTri.trim()}`);
  if (benA.mst.giaTri) dong.push(`MST: ${benA.mst.giaTri.trim()}`);
  if (benA.daiDien.giaTri) {
    const cv = benA.chucVu.giaTri?.trim();
    dong.push(`Đại diện: ${benA.daiDien.giaTri.trim()}${cv ? ` – ${cv}` : ""}`);
  }
  return dong.join("\n");
}

const chuoi = (s: string | null | undefined) => (s ?? "").trim();

export function sangBanNhap(ai: HopDongAi): BanNhapHopDong {
  // Khoá trường → trường AI. Khoá là tên ô trên form, để màn duyệt tô đúng ô.
  const nguon: Record<string, TruongAi<unknown>> = {
    contractNo: ai.soHopDong,
    signDate: ai.ngayKy,
    effectiveDate: ai.ngayHieuLuc,
    durationDays: ai.thoiHanNgay,
    subject: ai.trichYeu,
    partyAName: ai.benA.ten,
    partyAInfo: ai.benA.diaChi,
    tenBenB: ai.tenBenB,
    giaTriTruocVat: ai.giaTriTruocVat,
    vatPercent: ai.vatPhanTram,
    giaTriSauVat: ai.giaTriSauVat,
    giaTriBangChu: ai.giaTriBangChu,
  };
  const tinCayThap = Object.entries(nguon)
    .filter(([, f]) => f.giaTri != null && f.tinCay === "thap")
    .map(([k]) => k);
  const bangChung = Object.fromEntries(
    Object.entries(nguon)
      .filter(([, f]) => f.trichDan || f.trang != null)
      .map(([k, f]) => [k, { trichDan: f.trichDan, trang: f.trang }])
  );

  const ngayKhongHopLe: string[] = [];
  const ngay = (k: "signDate" | "effectiveDate", f: TruongAi<string>) => {
    if (!f.giaTri) return "";
    const n = chuanHoaNgay(f.giaTri);
    if (!n) ngayKhongHopLe.push(k);
    return n ?? "";
  };
  const signDate = ngay("signDate", ai.ngayKy);
  const effectiveDate = ngay("effectiveDate", ai.ngayHieuLuc);

  let hangMuc: DongHangMucNhap[] = ai.hangMuc.map((h) => ({
    name: chuoi(h.ten),
    unit: chuoi(h.donVi),
    qty: h.khoiLuong,
    unitPrice: h.donGia,
    amount: h.thanhTien,
    trang: h.trang,
  }));
  // Giá trị HĐ luôn là Σ hạng mục (xem recompute). HĐ trọn gói không có bảng hạng mục
  // mà vẫn phải ra đúng giá trị, nên tạo một dòng khoán.
  const hangMucTuDong = hangMuc.length === 0 && ai.giaTriTruocVat.giaTri != null;
  if (hangMucTuDong) {
    hangMuc = [
      {
        name: "Giá trị hợp đồng (trọn gói)",
        unit: "",
        qty: null,
        unitPrice: null,
        amount: ai.giaTriTruocVat.giaTri,
        trang: ai.giaTriTruocVat.trang,
      },
    ];
  }

  return {
    hopDong: {
      contractNo: chuoi(ai.soHopDong.giaTri),
      signDate,
      effectiveDate,
      durationDays: ai.thoiHanNgay.giaTri,
      subject: chuoi(ai.trichYeu.giaTri),
      partyAName: chuoi(ai.benA.ten.giaTri),
      partyAInfo: ghepThongTinBenA(ai.benA),
      // Có ngày ký thì là HĐ đã ký; người duyệt đổi được.
      status: signDate ? "SIGNED" : "QUOTE",
      vatPercent: ai.vatPhanTram.giaTri,
      paymentTerms: chuoi(ai.dieuKhoanThanhToan),
      note: "",
    },
    hangMuc,
    dotThanhToan: ai.dotThanhToan.map((d) => ({
      ten: chuoi(d.ten),
      phanTram: d.phanTram,
      soTien: d.soTien,
      dieuKien: chuoi(d.dieuKien),
    })),
    doiChieu: {
      giaTriTruocVat: ai.giaTriTruocVat.giaTri,
      giaTriSauVat: ai.giaTriSauVat.giaTri,
      giaTriBangChu: ai.giaTriBangChu.giaTri,
      tenBenB: ai.tenBenB.giaTri,
    },
    hangMucTuDong,
    tinCayThap,
    ngayKhongHopLe,
    bangChung,
    ghiChuAi: ai.ghiChuAi,
  };
}
