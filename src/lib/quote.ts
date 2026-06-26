// Tính toán báo giá chi tiết — dùng chung server + client. Không lưu cứng tổng.

export interface QuoteLine {
  qty: number | null;
  baseCost: number | null;
  sellPrice: number | null;
}

/** Thành tiền bán = khối lượng × đơn giá bán. */
export function lineSell(it: QuoteLine): number {
  return (it.qty ?? 0) * (it.sellPrice ?? 0);
}

/** Thành tiền gốc = khối lượng × giá gốc. */
export function lineCost(it: QuoteLine): number {
  return (it.qty ?? 0) * (it.baseCost ?? 0);
}

export interface QuoteTotals {
  sell: number;
  cost: number;
  profit: number;
  margin: number | null; // profit / sell
}

export function computeQuoteTotals(items: QuoteLine[]): QuoteTotals {
  let sell = 0;
  let cost = 0;
  for (const it of items) {
    sell += lineSell(it);
    cost += lineCost(it);
  }
  const profit = sell - cost;
  return { sell, cost, profit, margin: sell > 0 ? profit / sell : null };
}

/** Giá thành từ thành phần: (vật tư + nhân công/máy) × hệ số. */
export function computeBaseCost(
  material: number | null | undefined,
  laborMachine: number | null | undefined,
  coefficient: number | null | undefined
): number {
  const sum = (material ?? 0) + (laborMachine ?? 0);
  const hs = coefficient ?? 1;
  return sum * hs;
}

/** Đơn giá bán đề xuất = giá gốc × hệ số TL. */
export function sellFromBase(
  baseCost: number | null | undefined,
  markup: number | null | undefined
): number {
  return (baseCost ?? 0) * (markup ?? 1);
}
