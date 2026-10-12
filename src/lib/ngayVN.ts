// Ngày theo giờ Việt Nam (UTC+7) và ngưỡng "sắp đến hạn" — dùng chung cho cờ dự án và QC.
// Module lá, không import gì: projectHealth và qc cùng dựa vào đây mà không import vòng.

export const NGUONG_SAP_DEN_HAN = 7;
const NGAY = 86_400_000;
const LECH_VN = 7 * 3_600_000;

/** Mốc 00:00 giờ Việt Nam của ngày chứa `ms`. */
export function dauNgayVN(ms: number): number {
  return Math.floor((ms + LECH_VN) / NGAY) * NGAY - LECH_VN;
}

/** Số ngày VN từ `tu` tới `den` (âm nếu `den` ở trước). */
export function soNgay(tu: number, den: number): number {
  return Math.round((dauNgayVN(den) - dauNgayVN(tu)) / NGAY);
}
