import Link from "next/link";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { scopedByProjectWhere } from "@/lib/scope";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatVND, formatDate } from "@/lib/utils";
import { computeClientQuoteTotals } from "@/lib/clientQuote";
import { CLIENT_QUOTE_OPEN, CLIENT_QUOTE_STATUS_MAP } from "@/lib/constants";

export default async function ClientQuotesPage() {
  const session = await requireView("quote");

  const quotes = await db.clientQuote.findMany({
    where: await scopedByProjectWhere(session),
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, code: true, name: true } },
      customer: { select: { name: true } },
      lines: { select: { qty: true, unitPrice: true, amount: true } },
    },
  });

  const rows = quotes.map((q) => ({
    ...q,
    totals: computeClientQuoteTotals(q.lines, q.vatPercent),
  }));

  const dangTheoDuoi = rows.filter((q) => CLIENT_QUOTE_OPEN.includes(q.status));
  const daChot = rows.filter((q) => q.status === "CHOT");
  const tongDaChot = daChot.reduce((s, q) => s + q.totals.withVat, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Báo giá gửi khách</h1>
        <p className="text-sm text-slate-500">
          Báo giá theo hạng mục (m²) — {rows.length} bản
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng số</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Đang theo đuổi</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{dangTheoDuoi.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Đã chốt</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{daChot.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Giá trị đã chốt</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(tongDaChot)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án</Th>
              <Th hideBelow="md">Số BG</Th>
              <Th>Kính gửi</Th>
              <Th>Trạng thái</Th>
              <Th hideBelow="lg" className="text-right">Trước thuế</Th>
              <Th hideBelow="lg" className="text-right">VAT</Th>
              <Th className="text-right">Sau thuế</Th>
              <Th hideBelow="sm">Hiệu lực đến</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((q) => {
              const tt = CLIENT_QUOTE_STATUS_MAP[q.status];
              return (
                <Tr key={q.id}>
                  <Td className="font-medium">
                    <Link
                      href={`/projects/${q.project.id}/client-quote`}
                      className="text-blue-600 hover:underline"
                    >
                      <span className="font-mono">{q.project.code}</span> {q.project.name}
                    </Link>
                  </Td>
                  <Td hideBelow="md" className="font-mono text-slate-500">
                    {q.quoteNo ?? "—"}
                  </Td>
                  <Td className="text-slate-700">
                    {q.recipient ?? q.customer?.name ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? q.status}</Badge>
                  </Td>
                  <Td hideBelow="lg" className="text-right text-slate-500">
                    {formatVND(q.totals.beforeVat)}
                  </Td>
                  <Td hideBelow="lg" className="text-right text-slate-500">
                    {formatVND(q.totals.vat)}
                  </Td>
                  <Td className="text-right font-medium">{formatVND(q.totals.withVat)}</Td>
                  <Td hideBelow="sm" className="text-slate-500">
                    {q.expiryDate ? formatDate(q.expiryDate) : "—"}
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={8} className="py-8 text-center text-slate-400">
                  Chưa có báo giá gửi khách nào
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
