// Tính toán báo giá gửi khách (theo hạng mục, đơn vị m²) — dùng chung server + client.

/**
 * Làm tròn về đồng. Đây là CHỖ DUY NHẤT làm tròn tiền trong luồng báo giá gửi khách.
 *
 * Lý do phải có: `formatNumber` (utils.ts) và `docTienVietNam` (money-words.ts) mỗi
 * hàm tự `Math.round` riêng. Nếu VAT để số lẻ thì tổng in ra và dòng "Bằng chữ" có
 * thể lệch nhau một đồng — người nhận báo giá sẽ thấy hai con số khác nhau trên cùng
 * một trang giấy.
 */
export function roundVnd(n: number): number {
  return Math.round(n);
}

export interface ClientLine {
  qty?: number | null;
  unitPrice?: number | null;
  /** Điền = chốt cứng thành tiền, bỏ qua qty × unitPrice (dòng khoán). */
  amount?: number | null;
}

/**
 * Thành tiền của một dòng.
 *
 * Dùng `!= null` chứ KHÔNG dùng `||`: `amount = 0` là một giá trị hợp lệ (hạng mục
 * tặng kèm, đã tính vào dòng khác) và phải được tôn trọng, không được rơi về
 * qty × unitPrice.
 */
export function lineAmount(l: ClientLine): number {
  if (l.amount != null) return l.amount;
  return (l.qty ?? 0) * (l.unitPrice ?? 0);
}

export interface ClientQuoteTotals {
  beforeVat: number;
  vat: number;
  withVat: number;
}

/**
 * Cộng trước thuế / thuế VAT / tổng sau thuế.
 *
 * Khác `computeContractTotals` ở đúng một điểm: VAT được làm tròn NGAY tại đây, nên
 * `withVat` luôn là số nguyên và mọi nơi hiển thị nó đều ra cùng một con số.
 * `vatPercent` để trống nghĩa là không có thuế (0), không phải mặc định 10.
 */
export function computeClientQuoteTotals(
  lines: ClientLine[],
  vatPercent: number | null | undefined
): ClientQuoteTotals {
  const beforeVat = roundVnd(lines.reduce((s, l) => s + lineAmount(l), 0));
  const rate = vatPercent ?? 0;
  const vat = roundVnd((beforeVat * rate) / 100);
  return { beforeVat, vat, withVat: beforeVat + vat };
}

/** Tổng tiền theo từng "phần" (I, II…) — dòng in đậm gom nhóm khi in. */
export function partTotals(lines: (ClientLine & { partCode?: string | null })[]) {
  const m = new Map<string, number>();
  for (const l of lines) {
    const key = l.partCode ?? "";
    m.set(key, (m.get(key) ?? 0) + lineAmount(l));
  }
  return m;
}

export interface PaymentRow {
  percent?: number | null;
}

export interface PercentCheck {
  ok: boolean;
  sum: number;
  error: string | null;
}

/** Sai số cho phép khi cộng số thực — 33.33 + 33.33 + 33.34 phải được coi là 100. */
const DUNG_SAI = 0.01;

/**
 * Tổng tiến độ thanh toán phải bằng 100%.
 *
 * Danh sách rỗng thì coi là hợp lệ — người dùng chưa nhập gì thì không chặn lưu.
 * Riêng thao tác "Đã gửi" mới bắt buộc vừa hợp lệ vừa khác rỗng.
 */
export function validatePaymentPercents(rows: PaymentRow[]): PercentCheck {
  if (rows.length === 0) return { ok: true, sum: 0, error: null };
  const sum = rows.reduce((s, r) => s + (r.percent ?? 0), 0);
  if (Math.abs(sum - 100) <= DUNG_SAI) return { ok: true, sum, error: null };
  return {
    ok: false,
    sum,
    error: `Tiến độ thanh toán phải cộng đủ 100%, hiện đang là ${formatPercent(sum)}%.`,
  };
}

/** Bỏ số 0 thừa sau dấu phẩy: 95 -> "95", 33.335 -> "33.34". */
function formatPercent(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export interface StageRow {
  days?: number | null;
}

/** Tổng thời gian thi công = tổng số ngày của các chặng. */
export function sumStageDays(stages: StageRow[]): number {
  return stages.reduce((s, st) => s + (st.days ?? 0), 0);
}

/**
 * Ngày hết hiệu lực = ngày báo giá + số ngày hiệu lực.
 * Thiếu một trong hai thì không suy ra được — trả null chứ không đoán.
 */
export function expiryFrom(
  quoteDate: Date | null | undefined,
  validDays: number | null | undefined
): Date | null {
  if (quoteDate == null || validDays == null) return null;
  const d = new Date(quoteDate.getTime());
  d.setDate(d.getDate() + validDays);
  return d;
}
