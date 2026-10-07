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

// ----- Giá bán dự án suy ra từ hợp đồng -----
// HĐ đã ký (kể cả đã thanh lý) là nguồn chuẩn. Chưa HĐ nào ký thì tạm lấy các HĐ nháp
// để giá bán không đứng yên ở con số cũ trong lúc đang thương thảo.
export const SIGNED_CONTRACT_STATUSES = ["SIGNED", "LIQUIDATED"];

export interface ContractForSalePrice {
  status: string;
  valueBeforeVat: number | null;
}

export interface ContractSalePrice {
  /** Giá bán chưa VAT; null khi dự án chưa có hợp đồng nào. */
  salePrice: number | null;
  /** true khi đã có ít nhất một HĐ ký — giá bán bị khoá theo HĐ. */
  locked: boolean;
}

export function salePriceFromContracts(contracts: ContractForSalePrice[]): ContractSalePrice {
  if (contracts.length === 0) return { salePrice: null, locked: false };
  const signed = contracts.filter((c) => SIGNED_CONTRACT_STATUSES.includes(c.status));
  const nguon = signed.length > 0 ? signed : contracts;
  const salePrice = nguon.reduce((s, c) => s + (c.valueBeforeVat ?? 0), 0);
  return { salePrice, locked: signed.length > 0 };
}
