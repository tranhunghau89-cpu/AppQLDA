// Kế hoạch tiến độ căn cứ ngày HĐ có hiệu lực.
// - Ngày lịch, tính theo ngày (UTC, bỏ giờ) để không lệch múi giờ.
// - Giai đoạn N ngày bắt đầu ngày S thì kết thúc ngày S + N; giai đoạn sau bắt đầu
//   đúng ngày đó, trừ đi số ngày gối đầu. Cùng quy ước với hạn HĐ = hiệu lực + thời hạn.
// - Mốc không có số ngày giữ ngày kế hoạch nhập tay (dữ liệu cũ) và làm mốc neo cho
//   giai đoạn sau nó.

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
