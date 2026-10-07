// Cập nhật CẢ BẢNG đơn giá một lần — logic THUẦN, chạy được cả hai phía.
//
// Sửa trên lưới hay nhập từ Excel đều đổ về đây: nhận danh sách dòng người dùng
// muốn, so với giá chung đang áp dụng, và chỉ trả ra những mã THỰC SỰ đổi. Mã không
// đổi thì không sinh bản giá mới — nếu không, mỗi lần tải file về rồi nộp lại sẽ đẻ
// ra 128 bản giá trùng y hệt, và lịch sử giá thành rác.

import { computeBaseCost } from "@/lib/quote";

/** Một dòng người dùng muốn đặt. Đơn giá bỏ trống thì tính từ (VT + NC) × HS. */
export interface DongBangGia {
  ma: string;
  vatTu: number | null;
  nhanCongMay: number | null;
  heSo: number | null;
  donGia: number | null;
}

/** Giá chung đang áp dụng của một công tác (null = chưa có bản giá nào). */
export interface GiaDangApDung {
  vatTu: number | null;
  nhanCongMay: number | null;
  heSo: number | null;
  donGia: number;
}

export interface ThayDoiGia {
  ma: string;
  cu: GiaDangApDung | null;
  moi: GiaDangApDung;
}

export interface KetQuaSoSanh {
  thayDoi: ThayDoiGia[];
  khongDoi: number;
  loi: string[];
}

/** Đơn giá cuối cùng của một dòng nhập. */
export function donGiaCuaDong(d: DongBangGia): number {
  return d.donGia ?? computeBaseCost(d.vatTu, d.nhanCongMay, d.heSo);
}

// So số tiền tới 0,5 đồng: Excel hay trả 20599.999999 cho ô công thức.
const bang = (a: number | null, b: number | null) =>
  a === b || (a != null && b != null && Math.abs(a - b) < 0.5);
const bangHeSo = (a: number | null, b: number | null) =>
  a === b || (a != null && b != null && Math.abs(a - b) < 1e-9);

export function soSanhBangGia(
  dong: readonly DongBangGia[],
  hienTai: ReadonlyMap<string, GiaDangApDung | null>
): KetQuaSoSanh {
  const thayDoi: ThayDoiGia[] = [];
  const loi: string[] = [];
  const daGap = new Set<string>();
  let khongDoi = 0;

  for (const d of dong) {
    const ma = d.ma.trim();
    if (!ma) continue;
    if (daGap.has(ma)) {
      loi.push(`Mã ${ma} xuất hiện hai lần — chỉ giữ dòng đầu.`);
      continue;
    }
    daGap.add(ma);
    if (!hienTai.has(ma)) {
      loi.push(`Mã ${ma} không có trong thư viện — bỏ qua.`);
      continue;
    }
    // Ô trống cả bốn cột = người dùng không định giá dòng này, không phải giá 0.
    if (d.donGia == null && d.vatTu == null && d.nhanCongMay == null) continue;

    const donGia = donGiaCuaDong(d);
    // Giá 0 sẵn có trong thư viện (dữ liệu cũ) mà người dùng để nguyên: không phải lỗi.
    if (donGia === 0 && hienTai.get(ma)?.donGia === 0) {
      khongDoi++;
      continue;
    }
    if (!Number.isFinite(donGia) || donGia <= 0) {
      loi.push(`Mã ${ma}: đơn giá phải lớn hơn 0 — bỏ qua.`);
      continue;
    }
    const moi: GiaDangApDung = {
      vatTu: d.vatTu,
      nhanCongMay: d.nhanCongMay,
      heSo: d.heSo,
      donGia,
    };
    const cu = hienTai.get(ma) ?? null;
    if (
      cu &&
      bang(cu.donGia, moi.donGia) &&
      bang(cu.vatTu, moi.vatTu) &&
      bang(cu.nhanCongMay, moi.nhanCongMay) &&
      bangHeSo(cu.heSo, moi.heSo)
    ) {
      khongDoi++;
      continue;
    }
    thayDoi.push({ ma, cu, moi });
  }
  return { thayDoi, khongDoi, loi };
}

/**
 * Đọc số người dùng gõ kiểu Việt: "20.600" / "20600" / "20,5" / "1 250 000".
 * Trống → null; không phải số → NaN (để giao diện báo lỗi, KHÔNG lặng lẽ thành 0).
 */
export function docSoVN(s: string): number | null {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  if (!/^-?[\d.]*(,\d+)?$/.test(t)) return NaN;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
