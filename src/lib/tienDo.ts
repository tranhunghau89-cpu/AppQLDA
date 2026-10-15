// Kế hoạch tiến độ căn cứ ngày HĐ có hiệu lực.
// - Ngày lịch, tính theo ngày (UTC, bỏ giờ) để không lệch múi giờ.
// - Giai đoạn N ngày bắt đầu ngày S thì kết thúc ngày S + N; giai đoạn sau bắt đầu
//   đúng ngày đó, trừ đi số ngày gối đầu. Cùng quy ước với hạn HĐ = hiệu lực + thời hạn.
// - Mốc không có số ngày giữ ngày kế hoạch nhập tay (dữ liệu cũ) và làm mốc neo cho
//   giai đoạn sau nó.

import { MILESTONE_TYPE, MILESTONE_TYPE_MAP } from "./constants";

const NGAY = 86400000;

export const MOC_NGOAI_THOI_HAN = new Set(["HS_QT"]); // quyết toán không tính vào thời hạn HĐ

export interface MocDauVao {
  type: string;
  durationDays: number | null;
  overlapDays: number | null;
  planDate: Date | null; // ngày nhập tay, dùng khi không có durationDays
  actualDate: Date | null;
  done: boolean;
}

export interface MocKeHoach {
  type: string;
  batDau: Date | null;
  ketThuc: Date | null;
  tuTinh: boolean; // true = ketThuc do tính từ số ngày
}

export function ngayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function cong(d: Date, n: number): Date {
  return new Date(d.getTime() + n * NGAY);
}

export function soNgay(tu: Date, den: Date): number {
  return Math.round((ngayUTC(den).getTime() - ngayUTC(tu).getTime()) / NGAY);
}

export function lapKeHoach(hieuLuc: Date | null, mocs: MocDauVao[]): MocKeHoach[] {
  let conTro = hieuLuc ? ngayUTC(hieuLuc) : null;
  return mocs.map((m) => {
    if (m.durationDays != null && m.durationDays >= 0 && conTro) {
      let batDau = cong(conTro, -Math.max(0, m.overlapDays ?? 0));
      if (hieuLuc && batDau < ngayUTC(hieuLuc)) batDau = ngayUTC(hieuLuc);
      const ketThuc = cong(batDau, m.durationDays);
      conTro = ketThuc;
      return { type: m.type, batDau, ketThuc, tuTinh: true };
    }
    const ketThuc = m.planDate ? ngayUTC(m.planDate) : null;
    if (ketThuc) conTro = ketThuc;
    return { type: m.type, batDau: null, ketThuc, tuTinh: false };
  });
}

export interface DanhGiaThoiHan {
  hanHD: Date | null; // hiệu lực + thời hạn
  ketThucKH: Date | null; // mốc kế hoạch muộn nhất trong phạm vi thời hạn
  vuotKH: number | null; // > 0: kế hoạch vượt hạn HĐ bấy nhiêu ngày
  ketThucTT: Date | null; // ngày thực tế muộn nhất (đã xong hết) hoặc hôm nay (chưa xong)
  xongHet: boolean;
  vuotTT: number | null; // > 0: thực tế vượt hạn HĐ; chưa xong thì tính đến hôm nay
}

export function danhGiaThoiHan(
  hieuLuc: Date | null,
  thoiHanNgay: number | null,
  mocs: MocDauVao[],
  keHoach: MocKeHoach[],
  nowMs: number
): DanhGiaThoiHan {
  const hanHD = hieuLuc && thoiHanNgay != null ? cong(ngayUTC(hieuLuc), thoiHanNgay) : null;
  const tinh = (t: string) => !MOC_NGOAI_THOI_HAN.has(t);

  let ketThucKH: Date | null = null;
  for (const k of keHoach)
    if (tinh(k.type) && k.ketThuc && (!ketThucKH || k.ketThuc > ketThucKH)) ketThucKH = k.ketThuc;

  const trongHan = mocs.filter((m) => tinh(m.type));
  const xongHet = trongHan.length > 0 && trongHan.every((m) => m.done);
  let ketThucTT: Date | null = null;
  if (xongHet) {
    for (const m of trongHan)
      if (m.actualDate && (!ketThucTT || ngayUTC(m.actualDate) > ketThucTT))
        ketThucTT = ngayUTC(m.actualDate);
  } else {
    ketThucTT = ngayUTC(new Date(nowMs));
  }

  const vuotKH = hanHD && ketThucKH ? soNgay(hanHD, ketThucKH) : null;
  let vuotTT = hanHD && ketThucTT ? soNgay(hanHD, ketThucTT) : null;
  // Chưa xong mà chưa tới hạn thì không có gì để nói về "thực tế vượt".
  if (!xongHet && vuotTT != null && vuotTT <= 0) vuotTT = null;
  return { hanHD, ketThucKH, vuotKH, ketThucTT, xongHet, vuotTT };
}

// ----- Danh sách mốc của dự án: 8 mốc chuẩn (sửa tên/thứ tự/xóa được) + mốc tự thêm -----


export const MA_MOC_RIENG = /^KHAC_[a-z0-9]{6,24}$/;

export function laMaMocHopLe(type: string): boolean {
  return type in MILESTONE_TYPE_MAP || MA_MOC_RIENG.test(type);
}

export function tenMoc(m: { type: string; name?: string | null }): string {
  return m.name?.trim() || MILESTONE_TYPE_MAP[m.type]?.label || "Mốc";
}

export interface DongMoc {
  type: string;
  name?: string | null;
  sortOrder?: number | null;
  hidden?: boolean;
}

/** Mốc hiện trên bảng, theo thứ tự; mốc chuẩn chưa có dòng trong CSDL vẫn hiện. */
export function danhSachMoc<T extends DongMoc>(rows: T[]): { type: string; row: T | null }[] {
  const theoMa = new Map(rows.map((r) => [r.type, r]));
  const thuTuChuan = (t: string) => MILESTONE_TYPE.findIndex((m) => m.value === t);
  const ds: { type: string; row: T | null; thuTu: number }[] = [];
  MILESTONE_TYPE.forEach((m, i) => {
    const r = theoMa.get(m.value) ?? null;
    if (r?.hidden) return;
    ds.push({ type: m.value, row: r, thuTu: r?.sortOrder ?? i * 10 });
  });
  for (const r of rows)
    if (thuTuChuan(r.type) < 0 && !r.hidden) ds.push({ type: r.type, row: r, thuTu: r.sortOrder ?? 1e6 });
  return ds.sort((a, b) => a.thuTu - b.thuTu).map(({ type, row }) => ({ type, row }));
}

/** Hạn thanh toán theo mốc: ngày thực tế nếu mốc đã xong, chưa xong thì ngày kết thúc KH, + N ngày. */
export function hanTheoMoc(
  moc: { planDate: Date | null; actualDate: Date | null; done: boolean } | null,
  offsetDays: number | null
): Date | null {
  if (!moc) return null;
  const goc = moc.done && moc.actualDate ? moc.actualDate : moc.planDate;
  return goc ? cong(ngayUTC(goc), offsetDays ?? 0) : null;
}
