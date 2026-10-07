// Nạp 5 giá trị giai đoạn của một dự án từ CSDL (logic thuần ở giaTriGiaiDoan.ts).
import "server-only";
import { db } from "@/lib/db";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { settlementFromContracts } from "@/lib/contract";
import { computeActualCost, computeProfit } from "@/lib/profit";
import { baoGiaGiaiDoan, type GiaTriGiaiDoan } from "@/lib/giaTriGiaiDoan";

export async function docGiaTriGiaiDoan(projectId: string): Promise<GiaTriGiaiDoan | null> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: {
      salePrice: true,
      estimateItems: {
        select: {
          groupCode: true,
          designQty: true,
          actualQty: true,
          unitPrice: true,
          actualUnitPrice: true,
          amount: true,
        },
      },
      clientQuotes: {
        select: {
          status: true,
          createdAt: true,
          vatPercent: true,
          lines: { select: { qty: true, unitPrice: true, amount: true } },
        },
      },
      contracts: {
        select: {
          status: true,
          items: { select: { qty: true, unitPrice: true, amount: true, settleQty: true } },
        },
      },
    },
  });
  if (!p) return null;
  const thuc = computeActualCost(p.estimateItems);
  return {
    baoGia: baoGiaGiaiDoan(
      p.clientQuotes.map((q) => ({
        status: q.status,
        createdAt: q.createdAt,
        beforeVat: computeClientQuoteTotals(q.lines, q.vatPercent).beforeVat,
      }))
    ),
    duToan: computeProfit(p.estimateItems, null, null).totalCost,
    muaHang: thuc.total,
    soDongCoGiaThuc: thuc.soDongCoGia,
    soDong: thuc.soDong,
    hopDong: p.salePrice,
    quyetToan: settlementFromContracts(p.contracts),
  };
}
