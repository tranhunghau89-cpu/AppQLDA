import Link from "next/link";
import { Tags } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND, formatDate } from "@/lib/utils";
import { computeQuoteTotals } from "@/lib/quote";

export default async function QuotesPage() {
  await requireView("quote");

  const quotes = await db.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, code: true, name: true } },
      items: { select: { qty: true, sellPrice: true, baseCost: true } },
    },
  });

  const rows = quotes.map((q) => ({
    ...q,
    totals: computeQuoteTotals(q.items),
  }));
  const totalSell = rows.reduce((s, q) => s + q.totals.sell, 0);
  const totalProfit = rows.reduce((s, q) => s + q.totals.profit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Báo giá chi tiết</h1>
          <p className="text-sm text-slate-500">
            Tất cả báo giá theo Mã CV — {rows.length} bản
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <Tags className="h-4 w-4" /> Bảng đơn giá
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Số báo giá</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng giá bán</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(totalSell)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng lợi nhuận</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{formatVND(totalProfit)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án</Th>
              <Th>Tiêu đề báo giá</Th>
              <Th className="text-center">TL</Th>
              <Th className="text-right">Giá gốc</Th>
              <Th className="text-right">Giá bán</Th>
              <Th className="text-right">Lợi nhuận</Th>
              <Th className="text-right">Biên</Th>
              <Th>Ngày</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((q) => (
              <Tr key={q.id}>
                <Td className="font-medium">
                  <Link
                    href={`/projects/${q.project.id}/quote`}
                    className="text-blue-600 hover:underline"
                  >
                    <span className="font-mono">{q.project.code}</span> {q.project.name}
                  </Link>
                </Td>
                <Td className="text-slate-700">{q.title}</Td>
                <Td className="text-center text-slate-500">×{q.markup ?? 1}</Td>
                <Td className="text-right text-slate-500">{formatVND(q.totals.cost)}</Td>
                <Td className="text-right font-medium">{formatVND(q.totals.sell)}</Td>
                <Td className="text-right text-green-600">{formatVND(q.totals.profit)}</Td>
                <Td className="text-right text-slate-600">
                  {q.totals.margin != null ? `${(q.totals.margin * 100).toFixed(1)}%` : "—"}
                </Td>
                <Td className="text-slate-500">{q.quoteDate ? formatDate(q.quoteDate) : "—"}</Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-slate-400">
                  Chưa có báo giá nào
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
