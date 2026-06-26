import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatVND, formatNumber } from "@/lib/utils";
import { formatPercent } from "@/lib/profit";

export default async function CostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireView("cost");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      costSummary: {
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });
  if (!project) notFound();
  const cs = project.costSummary;

  const margin = cs?.revenue && cs.revenue > 0 ? (cs.profit ?? 0) / cs.revenue : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Tổng hợp chi phí — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">
            Quyết toán thực tế{project.location ? ` · ${project.location}` : ""}
            {project.customer ? ` · CĐT: ${project.customer.name}` : ""}
          </p>
        </div>
        {cs?.filePath && (
          <a
            href={`/api/costs/${cs.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <FileSpreadsheet className="h-4 w-4" /> Mở file THCP
          </a>
        )}
      </div>

      {!cs ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Dự án này chưa có dữ liệu tổng hợp chi phí
        </div>
      ) : (
        <>
          {/* Tài chính */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Doanh thu</div>
              <div className="mt-1 text-xl font-bold text-blue-600">{formatVND(cs.revenue ?? 0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Chi phí</div>
              <div className="mt-1 text-xl font-bold text-amber-600">{formatVND(cs.cost ?? 0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Lợi nhuận (LNTT)</div>
              <div className="mt-1 text-xl font-bold text-green-600">{formatVND(cs.profit ?? 0)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm text-slate-500">Biên lợi nhuận</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{formatPercent(margin)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Mini label="Đã chi (gồm VAT)" value={cs.paidWithVat} />
            <Mini label="Đã thu (gồm VAT)" value={cs.collectedWithVat} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Còn phải thu</div>
              <div className="mt-0.5 text-base font-semibold text-slate-800">
                {cs.collectionNote ?? (cs.receivable != null ? formatVND(cs.receivable) : "—")}
              </div>
            </div>
            <Mini label="VAT được nhận thêm" value={cs.extraVat} />
          </div>

          {/* Tổng hợp hạng mục */}
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-600">Tổng hợp hạng mục</div>
            <div className="rounded-xl border border-slate-200 bg-white">
              <Table>
                <THead>
                  <tr>
                    <Th>Hạng mục</Th>
                    <Th>NCC</Th>
                    <Th className="text-right">Giá trị</Th>
                    <Th className="text-right">Thanh toán</Th>
                    <Th className="text-right">Hóa đơn</Th>
                  </tr>
                </THead>
                <tbody>
                  {cs.categories.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium text-slate-900">
                        <span className="mr-1 font-mono text-slate-400">{c.code}</span>
                        {c.name}
                      </Td>
                      <Td className="text-slate-600">{c.supplier ?? "—"}</Td>
                      <Td className="text-right">{c.value != null ? formatVND(c.value) : "—"}</Td>
                      <Td className="text-right text-slate-600">
                        {c.payment != null ? formatVND(c.payment) : "—"}
                      </Td>
                      <Td className="text-right text-slate-600">
                        {c.invoice != null ? formatVND(c.invoice) : "—"}
                      </Td>
                    </Tr>
                  ))}
                  <Tr className="bg-slate-50 font-semibold">
                    <Td className="text-slate-900" {...{ colSpan: 2 }}>
                      Tổng chi phí
                    </Td>
                    <Td className="text-right">
                      {formatVND(cs.categories.reduce((s, c) => s + (c.value ?? 0), 0))}
                    </Td>
                    <Td className="text-right">
                      {formatVND(cs.categories.reduce((s, c) => s + (c.payment ?? 0), 0))}
                    </Td>
                    <Td className="text-right">
                      {formatVND(cs.categories.reduce((s, c) => s + (c.invoice ?? 0), 0))}
                    </Td>
                  </Tr>
                </tbody>
              </Table>
            </div>
          </div>

          {/* Chi tiết chi phí */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-600">Chi tiết chi phí</div>
            {cs.categories
              .filter((c) => c.items.length > 0)
              .map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-700">
                    <span className="mr-1 font-mono text-slate-400">{c.code}</span>
                    {c.name}
                  </div>
                  <Table>
                    <THead>
                      <tr>
                        <Th>Hạng mục</Th>
                        <Th className="text-right">Khối lượng</Th>
                        <Th className="text-right">Đơn giá</Th>
                        <Th className="text-right">Thành tiền</Th>
                        <Th>Ghi chú</Th>
                      </tr>
                    </THead>
                    <tbody>
                      {c.items.map((it) => (
                        <Tr key={it.id}>
                          <Td className="font-medium text-slate-900">{it.name}</Td>
                          <Td className="text-right">{formatNumber(it.qty)}</Td>
                          <Td className="text-right">{formatNumber(it.unitPrice)}</Td>
                          <Td className="text-right">
                            {it.amount != null ? formatVND(it.amount) : "—"}
                          </Td>
                          <Td className="text-slate-500">
                            {[it.ref, it.note].filter(Boolean).join(" · ") || "—"}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-800">
        {value != null ? formatVND(value) : "—"}
      </div>
    </div>
  );
}
