import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND } from "@/lib/utils";
import { formatPercent } from "@/lib/profit";

export default async function CostsPage() {
  await requireView("cost");

  const rows = await db.costSummary.findMany({
    include: { project: { select: { id: true, code: true, name: true, location: true } } },
    orderBy: { profit: "desc" },
  });

  const totRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tổng hợp chi phí</h1>
        <p className="text-sm text-slate-500">
          Quyết toán thực tế: doanh thu, chi phí, lợi nhuận và thanh toán theo dự án
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Số dự án quyết toán</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng doanh thu</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(totRevenue)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng chi phí</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{formatVND(totCost)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng lợi nhuận (LNTT)</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{formatVND(totProfit)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án</Th>
              <Th className="text-right">Doanh thu</Th>
              <Th className="text-right">Chi phí</Th>
              <Th className="text-right">LNTT</Th>
              <Th className="text-right">Biên LN</Th>
              <Th className="text-right">Còn phải thu</Th>
              <Th>File</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => {
              const margin = r.revenue && r.revenue > 0 ? (r.profit ?? 0) / r.revenue : null;
              return (
                <Tr key={r.id}>
                  <Td className="font-medium">
                    <Link
                      href={`/projects/${r.project.id}/cost`}
                      className="text-blue-600 hover:underline"
                    >
                      <span className="font-mono">{r.project.code}</span> {r.project.name}
                    </Link>
                    {r.project.location ? (
                      <span className="text-slate-400"> · {r.project.location}</span>
                    ) : null}
                  </Td>
                  <Td className="text-right">{formatVND(r.revenue ?? 0)}</Td>
                  <Td className="text-right text-amber-700">{formatVND(r.cost ?? 0)}</Td>
                  <Td className="text-right font-semibold text-green-700">{formatVND(r.profit ?? 0)}</Td>
                  <Td className="text-right text-slate-600">{formatPercent(margin)}</Td>
                  <Td className="text-right text-slate-600">
                    {r.collectionNote
                      ? r.collectionNote
                      : r.receivable != null
                        ? formatVND(r.receivable)
                        : "—"}
                  </Td>
                  <Td>
                    {r.filePath ? (
                      <a
                        href={`/api/costs/${r.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <FileSpreadsheet className="h-4 w-4" /> Mở
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td className="py-8 text-center text-slate-400" {...{ colSpan: 7 }}>
                  Chưa có dữ liệu — chạy <code>npm run import:thcp</code>
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
