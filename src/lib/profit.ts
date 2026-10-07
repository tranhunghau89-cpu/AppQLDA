import { ESTIMATE_GROUP } from "./constants";

export interface EstimateLine {
  groupCode: string;
  designQty: number | null;
  actualQty: number | null;
  unitPrice: number | null;
  amount: number | null;
  actualUnitPrice?: number | null;
}

/**
 * Thành tiền DỰ TOÁN 1 dòng: ưu tiên amount nhập sẵn, nếu trống tính KL thiết kế × đơn giá.
 * KL thực không tham gia — nó thuộc phần chi phí thực (computeActualAmount).
 */
export function computeAmount(item: EstimateLine): number {
  if (item.amount != null && item.amount !== 0) return item.amount;
  const qty = item.designQty ?? 0;
  const price = item.unitPrice ?? 0;
  return qty * price;
}

export interface ProfitSummary {
  totalCost: number;
  salePrice: number;
  profit: number;
  margin: number | null; // 0..1
  costPerM2: number | null;
  groupSubtotals: { code: string; label: string; amount: number }[];
}

export function computeProfit(
  items: EstimateLine[],
  salePrice: number | null | undefined,
  area: number | null | undefined
): ProfitSummary {
  const byGroup = new Map<string, number>();
  let totalCost = 0;

  for (const it of items) {
    const amt = computeAmount(it);
    totalCost += amt;
    byGroup.set(it.groupCode, (byGroup.get(it.groupCode) ?? 0) + amt);
  }

  const sale = salePrice ?? 0;
  const profit = sale - totalCost;

  const groupSubtotals = ESTIMATE_GROUP.filter((g) => byGroup.has(g.value)).map(
    (g) => ({ code: g.value, label: g.label, amount: byGroup.get(g.value) ?? 0 })
  );

  return {
    totalCost,
    salePrice: sale,
    profit,
    margin: sale > 0 ? profit / sale : null,
    costPerM2: area && area > 0 ? totalCost / area : null,
    groupSubtotals,
  };
}

export function formatPercent(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/** Thành tiền THỰC 1 dòng = (KL thực, trống thì KL dự toán) × đơn giá thực. Null = chưa có giá thực. */
export function computeActualAmount(item: EstimateLine): number | null {
  if (item.actualUnitPrice == null) return null;
  return (item.actualQty ?? item.designQty ?? 0) * item.actualUnitPrice;
}

export interface ActualCost {
  /** Tổng chi phí thực; dòng chưa có giá thực tạm lấy số dự toán. */
  total: number;
  soDongCoGia: number;
  soDong: number;
}

export function computeActualCost(items: EstimateLine[]): ActualCost {
  let total = 0;
  let soDongCoGia = 0;
  for (const it of items) {
    const thuc = computeActualAmount(it);
    if (thuc != null) soDongCoGia++;
    total += thuc ?? computeAmount(it);
  }
  return { total, soDongCoGia, soDong: items.length };
}
