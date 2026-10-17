// Khối lượng món đơn hàng — tính lại từ quy cách như file Excel đơn đặt hàng. Hàm THUẦN.
//
// Thứ tự ưu tiên, giống cách người lập đơn tra tay:
//   1. Bulông (tên dạng M20x70, đơn vị bộ/cái): kg/bộ từ thư viện, rồi công thức.
//   2. Cáp (quy cách có chữ "cáp" + Dxx): kg/m theo bảng STD Cáp × chiều dài.
//   3. Thép tròn — rod, ty (Dxx + chiều dài): π·d²/4·7850 × chiều dài.
//   4. Tôn (quy cách có "dày …mm" + "khổ …mm" + chiều dài): dài × khổ × dày × 7,85.
// Không đọc ra thì null — chỗ gọi tự quyết (giữ số cũ hoặc co giãn theo SL).

import { norm } from "@/lib/text";
import {
  laDonViDem,
  traKgMotDonVi,
  type MauKg,
} from "@/lib/thuVien/trongLuongBulong";

/** Bảng "STD Cáp" của file mẫu: kg/m cáp theo đường kính. */
export const KG_M_CAP: Record<number, number> = {
  12: 0.888,
  14: 1.21,
  16: 1.58,
  18: 2,
  20: 2.47,
  24: 3.56,
};

const soVi = (s: string) => Number(s.replace(",", "."));

/** "dày 0.45mm" → 0.45; "khổ hữu dụng 1000mm" → 1000. */
export function docQuyCachTon(
  spec: string | null | undefined,
): { day: number; kho: number } | null {
  const s = (spec ?? "").toLowerCase();
  const day = s.match(/d[àa]y\s*([\d.,]+)\s*mm/);
  const kho = s.match(/kh[ổo](?:\s*h[ữu]u\s*d[ụu]ng)?\s*([\d.,]+)\s*mm/);
  if (!day || !kho) return null;
  const d = soVi(day[1]);
  const k = soVi(kho[1]);
  return d > 0 && k > 0 ? { day: d, kho: k } : null;
}

/** "Giằng Rod D16", "Ty xà gồ D12" → 16. Chỉ nhận 6..60mm, để "Phễu thu D90" không thành thép tròn. */
export function docDuongKinh(
  ...nguon: (string | null | undefined)[]
): number | null {
  for (const s of nguon) {
    const m = (s ?? "").match(/(?:^|[^A-Za-z])[DØ]\s*(\d{1,2})(?!\d)/i);
    if (m) {
      const d = Number(m[1]);
      if (d >= 6 && d <= 60) return d;
    }
  }
  return null;
}

export interface MonTinhKg {
  name: string;
  unit: string | null;
  /** Chiều dài một cây/tấm/sợi, mm. */
  length: number | null;
  /** Quy cách chung của nhóm (dòng tiêu đề hạng mục) và tên nhóm vật tư. */
  quyCach: string | null;
  nhom: string | null;
}

export interface KgMotDonVi {
  kg: number;
  cach: "BULONG" | "CAP" | "THEP_TRON" | "TON";
}

/** Kg của MỘT đơn vị (một bộ / một cây / một tấm). */
export function kgMotDonVi(
  m: MonTinhKg,
  thuVien: readonly MauKg[],
): KgMotDonVi | null {
  const L = m.length != null && m.length > 0 ? m.length / 1000 : null; // m
  const ngu = norm(`${m.nhom ?? ""} ${m.quyCach ?? ""} ${m.name}`);

  if (laDonViDem(m.unit) || /^m\d/i.test(m.name.trim())) {
    const bl = traKgMotDonVi(m.name, thuVien);
    if (bl) return { kg: bl.kg, cach: "BULONG" };
  }
  if (L == null) return null;

  const d = docDuongKinh(m.quyCach, m.nhom, m.name);
  if (d != null && ngu.includes("cap") && KG_M_CAP[d] != null) {
    return { kg: lam(KG_M_CAP[d] * L), cach: "CAP" };
  }
  if (d != null && /rod|ty|thanhren|thep/.test(ngu)) {
    return {
      kg: lam(((Math.PI * (d / 1000) ** 2) / 4) * 7850 * L),
      cach: "THEP_TRON",
    };
  }
  const ton = docQuyCachTon(m.quyCach) ?? docQuyCachTon(m.name);
  if (ton)
    return { kg: lam(L * (ton.kho / 1000) * ton.day * 7.85), cach: "TON" };
  return null;
}

const lam = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Kg mới của cả dòng sau khi sửa. Tính được từ quy cách thì lấy số tính; không thì co
 * giãn kg cũ theo SL (đổi SL 4 → 8 thì kg gấp đôi) — đúng cho mọi dòng nhập từ Excel
 * mà chỉ có tổng kg. Trả `undefined` = giữ nguyên kg đang có.
 */
export function kgSauKhiSua(
  cu: { qty: number | null; weight: number | null },
  moi: MonTinhKg & { qty: number | null },
  thuVien: readonly MauKg[],
): number | null | undefined {
  const k = kgMotDonVi(moi, thuVien);
  if (k && moi.qty != null) return lam(k.kg * moi.qty);
  if (cu.weight != null && cu.qty && moi.qty != null && moi.qty !== cu.qty) {
    return lam((cu.weight * moi.qty) / cu.qty);
  }
  return undefined;
}

export interface TongNhom {
  kg: number;
  /** Tổng chiều dài, m — chỉ các dòng có chiều dài. */
  dai: number;
  /** Tổng diện tích, m² — chỉ các dòng tôn (đọc được khổ). */
  m2: number;
}

/** Tổng của một nhóm như dòng "Tổng cộng" trong Excel: kg, tổng dài (m), tổng m². */
export function tongNhom(
  ds: readonly {
    qty: number | null;
    length: number | null;
    weight: number | null;
    quyCach: string | null;
  }[],
): TongNhom {
  let kg = 0;
  let dai = 0;
  let m2 = 0;
  for (const x of ds) {
    kg += x.weight ?? 0;
    if (x.length && x.qty) {
      const d = (x.length * x.qty) / 1000;
      dai += d;
      const ton = docQuyCachTon(x.quyCach);
      if (ton) m2 += (d * ton.kho) / 1000;
    }
  }
  return { kg: lam(kg), dai: lam(dai), m2: lam(m2) };
}
