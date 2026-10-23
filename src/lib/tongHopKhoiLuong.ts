// Tổng hợp khối lượng vật tư chính (thép tổ hợp, thép hình, xà gồ, tôn) của dự toán thi
// công, cộng theo từng hạng mục. Hàm thuần — dùng ở cột tổng hợp trang dự toán.
//
// Nhận diện theo TÊN dòng: loại chi phí (groupCode) không đủ, vì xà gồ hay nằm chung
// nhóm "Kết cấu thép", và thép tổ hợp / thép hình cùng loại KCT. Dòng tên chung chung
// ("Vật tư" dưới nhóm "Tôn mái") thì mượn tên nhóm. Dòng công (vận chuyển, lắp dựng,
// lợp…) và dòng tự tính từ tham số không phải vật tư nên bỏ qua.

export type LoaiVatTu = "THEP_TO_HOP" | "THEP_HINH" | "XA_GO" | "TON";

export const LOAI_VAT_TU: { code: LoaiVatTu; label: string }[] = [
  { code: "THEP_TO_HOP", label: "Thép tổ hợp" },
  { code: "THEP_HINH", label: "Thép hình" },
  { code: "XA_GO", label: "Xà gồ" },
  { code: "TON", label: "Tôn" },
];

export interface DongKhoiLuong {
  sectionId: string | null;
  name: string;
  groupLabel: string | null;
  unit: string | null;
  designQty: number | null;
  actualQty: number | null;
  layTuThamSo?: string | null;
}

export interface KhoiLuongHangMuc {
  sectionId: string | null;
  duToan: number;
  thucTe: number;
  soDong: number;
  soDongCoThuc: number;
}

export interface KhoiLuongVatTu {
  /** Khoá = loại + đơn vị: cùng là "tôn" nhưng m² và tấm không cộng chung được. */
  key: string;
  loai: LoaiVatTu;
  label: string;
  unit: string;
  duToan: number;
  thucTe: number;
  soDong: number;
  soDongCoThuc: number;
  hangMuc: KhoiLuongHangMuc[];
}

/** Bỏ dấu, chữ thường, giữ khoảng trắng giữa các từ: "Tôn mái" → " ton mai ". */
function chu(s: string | null | undefined): string {
  return (
    " " +
    (s ?? "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() +
    " "
  );
}

const CONG = [" van chuyen ", " lap dung ", " lap dat ", " lop ", " nhan cong ", " thi cong ", " gia cong ", " son ", " ma kem "];
const PHU_KIEN = [" ty ", " giang ", " bulong ", " bu long ", " ecu ", " long den ", " vit ", " thanh ren "];

function loaiTheoChu(t: string): LoaiVatTu | null {
  if (t.includes(" to hop ")) return "THEP_TO_HOP";
  if (t.includes(" thep hinh ")) return "THEP_HINH";
  if (t.includes(" xa go ")) return "XA_GO";
  if (t.includes(" ton ")) return "TON";
  return null;
}

/** Loại vật tư chính của một dòng dự toán, null nếu không phải. */
export function loaiVatTu(d: Pick<DongKhoiLuong, "name" | "groupLabel" | "layTuThamSo">): LoaiVatTu | null {
  if (d.layTuThamSo) return null;
  const ten = chu(d.name);
  if (CONG.some((w) => ten.includes(w))) return null;
  // "Ty xà gồ", "Giằng xà gồ", "Bulong liên kết xà gồ" là phụ kiện, không phải xà gồ.
  if (PHU_KIEN.some((w) => ten.includes(w))) return null;
  const theoTen = loaiTheoChu(ten);
  if (theoTen) return theoTen;
  // Nhóm "Bulong, ty xà gồ" cũng là phụ kiện — "Vật tư" dưới đó không phải xà gồ.
  const nhom = chu(d.groupLabel);
  if (PHU_KIEN.some((w) => nhom.includes(w))) return null;
  return loaiTheoChu(nhom);
}

/** "m2", "M²", "m 2" → "m²"; trống → "". */
function donVi(u: string | null): string {
  const t = (u ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (t === "m2" || t === "m²") return "m²";
  return t;
}

/** Cộng khối lượng vật tư chính theo loại + đơn vị, rồi theo hạng mục (giữ thứ tự gặp). */
export function tongHopKhoiLuong(dong: DongKhoiLuong[]): KhoiLuongVatTu[] {
  const theoKhoa = new Map<string, KhoiLuongVatTu>();
  for (const d of dong) {
    const loai = loaiVatTu(d);
    if (!loai) continue;
    const unit = donVi(d.unit);
    const key = `${loai}|${unit}`;
    let vt = theoKhoa.get(key);
    if (!vt) {
      vt = {
        key,
        loai,
        label: LOAI_VAT_TU.find((l) => l.code === loai)!.label,
        unit,
        duToan: 0,
        thucTe: 0,
        soDong: 0,
        soDongCoThuc: 0,
        hangMuc: [],
      };
      theoKhoa.set(key, vt);
    }
    let hm = vt.hangMuc.find((h) => h.sectionId === d.sectionId);
    if (!hm) {
      hm = { sectionId: d.sectionId, duToan: 0, thucTe: 0, soDong: 0, soDongCoThuc: 0 };
      vt.hangMuc.push(hm);
    }
    const dt = d.designQty ?? 0;
    const coThuc = d.actualQty != null;
    for (const x of [vt, hm]) {
      x.duToan += dt;
      x.thucTe += d.actualQty ?? 0;
      x.soDong += 1;
      if (coThuc) x.soDongCoThuc += 1;
    }
  }
  const thuTu = (v: KhoiLuongVatTu) => LOAI_VAT_TU.findIndex((l) => l.code === v.loai);
  return [...theoKhoa.values()].sort((a, b) => thuTu(a) - thuTu(b) || b.duToan - a.duToan);
}
