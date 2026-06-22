import Link from "next/link";
import { db } from "@/lib/db";
import { Download } from "lucide-react";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { computeProfit, formatPercent } from "@/lib/profit";
import { formatVND } from "@/lib/utils";

export default async function EstimatesPage() {
  const session = await requireView("estimate");
  const canViewProfit = can(session.role, "profit", "view");

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    include: {
      estimateItems: {
        select: {
          groupCode: true,
          designQty: true,
          actualQty: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  });

  const rows = projects.map((p) => {
    const s = computeProfit(p.estimateItems, p.salePrice, p.area);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      ...s,
      itemCount: p.estimateItems.length,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.cost += r.totalCost;
      acc.sale += r.salePrice;
      acc.profit += r.profit;
      return acc;
    },
    { cost: 0, sale: 0, profit: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dự toán & Chi phí</h1>
          <p className="text-sm text-slate-500">
            Tổng hợp chi phí, giá bán và lợi nhuận theo dự án
          </p>
        </div>
        <a
          href="/api/export/projects"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Xuất Excel
        </a>
      </div>

      {canViewProfit && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Tổng chi phí" value={formatVND(totals.cost)} tone="slate" />
          <SummaryCard label="Tổng giá bán" value={formatVND(totals.sale)} tone="blue" />
          <SummaryCard
            label="Tổng lợi nhuận"
            value={formatVND(totals.profit)}
            tone={totals.profit >= 0 ? "green" : "red"}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Mã</Th>
              <Th>Tên dự án</Th>
              <Th>Trạng thái</Th>
              <Th className="text-right">Tổng chi phí</Th>
              {canViewProfit && <Th className="text-right">Giá bán</Th>}
              {canViewProfit && <Th className="text-right">Lợi nhuận</Th>}
              {canViewProfit && <Th className="text-right">Biên</Th>}
              <Th className="text-right">CP/m²</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-mono font-medium">
                  <Link href={`/projects/${r.id}/estimate`} className="text-blue-600 hover:underline">
                    {r.code}
                  </Link>
                </Td>
                <Td className="font-medium text-slate-900">{r.name}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="text-right">{formatVND(r.totalCost)}</Td>
                {canViewProfit && <Td className="text-right">{formatVND(r.salePrice)}</Td>}
                {canViewProfit && (
                  <Td
                    className={`text-right font-medium ${
                      r.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatVND(r.profit)}
                  </Td>
                )}
                {canViewProfit && (
                  <Td className="text-right">{formatPercent(r.margin)}</Td>
                )}
                <Td className="text-right">
                  {r.costPerM2 != null ? formatVND(r.costPerM2) : "—"}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "blue" | "green" | "red";
}) {
  const color = {
    slate: "text-slate-900",
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
