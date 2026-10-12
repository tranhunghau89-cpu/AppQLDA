// Giá trị hợp đồng đại diện của một dự án. Tách khỏi debt.ts (file đó import db) để
// client component dùng được qua projectHealth mà không kéo Prisma vào bundle.

export interface ContractValueInput {
  valueWithVat: number | null;
  status: string;
  signDate: Date | null;
}

/** Giá trị hợp đồng đại diện của 1 dự án: ưu tiên HĐ đã ký mới nhất. */
export function pickContractValue(contracts: ContractValueInput[]): number | null {
  if (contracts.length === 0) return null;
  const ranked = [...contracts].sort((a, b) => {
    const sa = a.status === "SIGNED" || a.status === "LIQUIDATED" ? 1 : 0;
    const sb = b.status === "SIGNED" || b.status === "LIQUIDATED" ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.signDate?.getTime() ?? 0) - (a.signDate?.getTime() ?? 0);
  });
  return ranked[0].valueWithVat ?? null;
}
