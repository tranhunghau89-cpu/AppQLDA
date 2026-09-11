// Hai phép tính phụ cho hộp thoại Điều khoản: mốc ngày cộng dồn của tiến độ thi công,
// và số tiền thật của từng đợt thanh toán.
import { roundVnd, validatePaymentPercents } from "./clientQuote";

/**
 * Ngày kết thúc (cộng dồn) của từng chặng: [3, 15, 2, 25, 10] -> [3, 18, 20, 45, 55].
 *
 * Người lập nghĩ theo từng chặng ("gia công 15 ngày"), nhưng khách hỏi "bao giờ xong".
 * Hiện cả hai cạnh nhau thì không ai phải cộng nhẩm.
 */
export function congDonNgay(stages: { days?: number | null }[]): number[] {
  let cong = 0;
  return stages.map((s) => {
    cong += s.days ?? 0;
    return cong;
  });
}

/**
 * Số tiền của từng đợt thanh toán, theo tổng sau thuế.
 *
 * Bản in chỉ có phần trăm; cột tiền này chỉ để nhìn trên màn hình. Nhưng nhìn thấy
 * "30% = 235.035.042 ₫" thì người lập quyết định khác hẳn so với khi chỉ thấy "30".
 *
 * Làm tròn từng đợt riêng lẻ có thể khiến cột tiền cộng lại lệch tổng vài đồng — một
 * cột tiền không cộng đúng trông như phần mềm hỏng. Nên khi các đợt đã đủ 100%, đợt
 * cuối cùng nhận phần dư. Còn khi CHƯA đủ 100% thì không bù gì cả: lúc đó cột tiền
 * lệch tổng là đúng, và đó chính là điều cần thấy.
 */
export function tienCacDot(
  tongSauThue: number,
  percents: (number | null)[]
): (number | null)[] {
  const tien = percents.map((p) => (p == null ? null : roundVnd((tongSauThue * p) / 100)));

  const du = validatePaymentPercents(percents.map((percent) => ({ percent })));
  if (!du.ok) return tien;

  let cuoi = -1;
  for (let i = tien.length - 1; i >= 0; i--) {
    if (tien[i] != null) {
      cuoi = i;
      break;
    }
  }
  if (cuoi < 0) return tien;

  const cong = tien.reduce<number>((s, t) => s + (t ?? 0), 0);
  tien[cuoi] = (tien[cuoi] as number) + (roundVnd(tongSauThue) - cong);
  return tien;
}
