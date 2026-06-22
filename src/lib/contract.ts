// Tính tổng giá trị hợp đồng từ các dòng hạng mục.
export interface ContractLine {
  qty?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
}

export function lineAmount(l: ContractLine): number {
  if (l.amount != null) return l.amount;
  if (l.qty != null && l.unitPrice != null) return l.qty * l.unitPrice;
  return 0;
}

export interface ContractTotals {
  beforeVat: number;
  vat: number;
  withVat: number;
}

export function computeContractTotals(
  items: ContractLine[],
  vatPercent: number | null | undefined
): ContractTotals {
  const beforeVat = items.reduce((s, l) => s + lineAmount(l), 0);
  const rate = vatPercent != null ? vatPercent : 0;
  const vat = (beforeVat * rate) / 100;
  return { beforeVat, vat, withVat: beforeVat + vat };
}
