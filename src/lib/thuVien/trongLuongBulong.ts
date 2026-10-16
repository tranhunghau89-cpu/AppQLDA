/**
 * Ước tính trọng lượng MỘT BỘ bulong / ty xà gồ / bulong neo từ quy cách trong tên.
 *
 * Đây là số TƯƠNG ĐỐI để quy đổi bộ → kg khi chưa có bảng của nhà cung cấp: tính hình
 * học thép (7,85 t/m³) theo kích thước tiêu chuẩn — đầu lục giác ISO 4014, ecu ISO 4032,
 * long đen phẳng ISO 7089. Thân tính theo đường kính danh nghĩa nên lệch vài % so với
 * bulong thật (phần ren nhỏ hơn). Người dùng luôn ghi đè được bằng số thật.
 *
 * Cấu tạo một "bộ" (theo cách mua thông dụng):
 *   - Bulong liên kết: 1 bulong + 1 ecu + 2 long đen.
 *   - Bulong neo:      1 thanh ren dài L + 2 ecu + 2 long đen.
 *   - Ty xà gồ:        1 thanh ren dài L + 2 ecu + 2 long đen.
 *   - Ecu / long đen bán lẻ: một cái.
 */

const RHO = 7.85e-6; // kg/mm³

/** s: cạnh đối lục giác, k: cao đầu bulong, m: cao ecu, d1/d2/h: long đen. Đơn vị mm. */
const CO: Record<number, { s: number; k: number; m: number; d1: number; d2: number; h: number }> = {
  6: { s: 10, k: 4, m: 5.2, d1: 6.4, d2: 12, h: 1.6 },
  8: { s: 13, k: 5.3, m: 6.8, d1: 8.4, d2: 16, h: 1.6 },
  10: { s: 16, k: 6.4, m: 8.4, d1: 10.5, d2: 20, h: 2 },
  12: { s: 18, k: 7.5, m: 10.8, d1: 13, d2: 24, h: 2.5 },
  14: { s: 21, k: 8.8, m: 12.8, d1: 15, d2: 28, h: 2.5 },
  16: { s: 24, k: 10, m: 14.8, d1: 17, d2: 30, h: 3 },
  18: { s: 27, k: 11.5, m: 15.8, d1: 19, d2: 34, h: 3 },
  20: { s: 30, k: 12.5, m: 18, d1: 21, d2: 37, h: 3 },
  22: { s: 34, k: 14, m: 19.4, d1: 23, d2: 39, h: 3 },
  24: { s: 36, k: 15, m: 21.5, d1: 25, d2: 44, h: 4 },
  27: { s: 41, k: 17, m: 23.8, d1: 28, d2: 50, h: 4 },
  30: { s: 46, k: 18.7, m: 25.6, d1: 31, d2: 56, h: 4 },
  36: { s: 55, k: 22.5, m: 31, d1: 37, d2: 66, h: 5 },
};

export const CO_HO_TRO = Object.keys(CO).map(Number);

export type LoaiBulong = "BULONG" | "NEO" | "TY" | "ECU" | "LONG_DEN";

export interface QuyCachBulong {
  loai: LoaiBulong;
  /** Đường kính danh nghĩa, mm. */
  d: number;
  /** Chiều dài thân / thanh ren, mm. Null với ecu, long đen. */
  L: number | null;
}

const lucGiac = (s: number) => (Math.sqrt(3) / 2) * s * s;
const tron = (d: number) => (Math.PI / 4) * d * d;

const kgThan = (d: number, L: number) => tron(d) * L * RHO;
const kgDau = (d: number) => lucGiac(CO[d].s) * CO[d].k * RHO;
const kgEcu = (d: number) => (lucGiac(CO[d].s) - tron(d)) * CO[d].m * RHO;
const kgLongDen = (d: number) => (tron(CO[d].d2) - tron(CO[d].d1)) * CO[d].h * RHO;

/** Trọng lượng một bộ, kg. Null khi thiếu chiều dài hoặc cỡ ngoài bảng. */
export function kgMotBo(q: QuyCachBulong): number | null {
  if (!CO[q.d]) return null;
  switch (q.loai) {
    case "ECU":
      return kgEcu(q.d);
    case "LONG_DEN":
      return kgLongDen(q.d);
    case "BULONG":
      if (!q.L) return null;
      return kgThan(q.d, q.L) + kgDau(q.d) + kgEcu(q.d) + 2 * kgLongDen(q.d);
    case "NEO":
    case "TY":
      if (!q.L) return null;
      return kgThan(q.d, q.L) + 2 * kgEcu(q.d) + 2 * kgLongDen(q.d);
  }
}

export const CAU_TAO: Record<LoaiBulong, string> = {
  BULONG: "1 bulong + 1 ecu + 2 long đen",
  NEO: "thanh ren L + 2 ecu + 2 long đen",
  TY: "thanh ren L + 2 ecu + 2 long đen",
  ECU: "1 ecu",
  LONG_DEN: "1 long đen",
};

/** Bỏ dấu, thường hoá — "Bulông neo" và "bu long neo" là một. */
function phang(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/**
 * Đọc quy cách từ tên / quy cách gõ tự do.
 *
 * Nhận: "M16x50", "M16*50", "M16 x 50", "Bulong neo M24x800", "Ty xà gồ Ø12 L=1500",
 * "Ty D12x1200", "Ecu M20", "Long đen M16". Không chắc thì trả null — đoán sai còn tệ
 * hơn để trống, vì số đoán sai lặng lẽ đi vào tổng kg.
 */
export function docQuyCach(...nguon: (string | null | undefined)[]): QuyCachBulong | null {
  const t = phang(nguon.filter(Boolean).join(" "));
  if (!t.trim()) return null;

  const laTy = /\bty\b|thanh ren|giang xa go|ty xa go/.test(t);
  const laNeo = /neo|\bj\b|bulong mong|bu long mong/.test(t);
  const laEcu = /\becu\b|\bdai oc\b|\bnut\b/.test(t) && !/bu ?long|ty\b/.test(t);
  const laLongDen = /long den|vong dem|\bwasher\b/.test(t) && !/bu ?long|ty\b/.test(t);

  // Đường kính: M16, Ø16, D16, phi16.
  const md = t.match(/(?:\bm|ø|\bd|phi)\s?(\d{1,2})(?!\d)/);
  const d = md ? Number(md[1]) : null;
  if (!d || !CO[d]) return null;

  if (laEcu) return { loai: "ECU", d, L: null };
  if (laLongDen) return { loai: "LONG_DEN", d, L: null };

  // Chiều dài: "x50", "*50", "L=1500", "L1500", "dai 1500".
  const ml =
    t.match(/(?:\bm|ø|\bd|phi)\s?\d{1,2}\s*[x×*]\s*(\d{2,4})(?!\d)/) ??
    t.match(/\bl\s*=?\s*(\d{2,4})(?!\d)/) ??
    t.match(/dai\s*(\d{2,4})(?!\d)/);
  const L = ml ? Number(ml[1]) : null;

  const loai: LoaiBulong = laTy ? "TY" : laNeo ? "NEO" : "BULONG";
  return { loai, d, L };
}

export interface GoiYKg {
  kg: number;
  quyCach: QuyCachBulong;
  cauTao: string;
}

/** Gợi ý kg cho MỘT đơn vị (bộ/cái) từ tên — null khi không đọc ra quy cách đủ. */
export function goiYKgMotBo(...nguon: (string | null | undefined)[]): GoiYKg | null {
  const q = docQuyCach(...nguon);
  if (!q) return null;
  const kg = kgMotBo(q);
  if (kg == null) return null;
  return { kg: Math.round(kg * 1000) / 1000, quyCach: q, cauTao: CAU_TAO[q.loai] };
}

/** Đơn vị đếm (bộ/cái/con/chiếc) — những đơn vị cần quy đổi sang kg. */
export function laDonViDem(dv: string | null | undefined): boolean {
  return /^(bo|cai|con|chiec|pcs|set)$/.test(phang(dv ?? "").trim());
}

/** Một công tác thư viện đã khai trọng lượng một đơn vị. */
export interface MauKg {
  ten: string;
  quyCach: string | null;
  khoiLuongDonVi: number;
}

export interface TraKg {
  kg: number;
  /** THU_VIEN = số đã khai trong thư viện (ưu tiên); CONG_THUC = ước tính hình học. */
  nguon: "THU_VIEN" | "CONG_THUC";
  ghiChu: string;
}

const cungQuyCach = (a: QuyCachBulong, b: QuyCachBulong) =>
  a.loai === b.loai && a.d === b.d && a.L === b.L;

/**
 * Kg của MỘT đơn vị (bộ/cái) theo tên: thư viện đã khai thì lấy thư viện (khớp loại,
 * đường kính, chiều dài), không thì ước tính theo công thức. Không đọc ra quy cách → null.
 */
export function traKgMotDonVi(
  ten: string | null | undefined,
  thuVien: readonly MauKg[]
): TraKg | null {
  const q = docQuyCach(ten);
  if (!q) return null;
  const mau = thuVien.find((m) => {
    const qm = docQuyCach(m.ten, m.quyCach);
    return qm != null && cungQuyCach(qm, q);
  });
  if (mau) return { kg: mau.khoiLuongDonVi, nguon: "THU_VIEN", ghiChu: `theo thư viện: ${mau.ten}` };
  const kg = kgMotBo(q);
  if (kg == null) return null;
  return {
    kg: Math.round(kg * 1000) / 1000,
    nguon: "CONG_THUC",
    ghiChu: `ước tính: ${CAU_TAO[q.loai]}`,
  };
}
