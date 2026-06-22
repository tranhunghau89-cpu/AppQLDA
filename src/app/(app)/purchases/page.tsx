import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PO_CATEGORY_MAP, PO_STATUS, PO_STATUS_MAP } from "@/lib/constants";
import { formatVND, formatNumber, formatDate } from "@/lib/utils";

export default async function PurchasesPage() {
  await requireView("purchase");

  const orders = await db.purchaseOrder.findMany({
    orderBy: [{ orderDate: "desc" }, { category: "asc" }],
    include: {
      project: { select: { id: true, code: true, name: true } },
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  const totalWeight = orders.reduce((s, o) => s + (o.totalWeight ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Đơn hàng & Mua hàng</h1>
        <p className="text-sm text-slate-500">
          Đơn đặt hàng vật tư gửi nhà cung cấp, trạng thái và giá trị mua
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {PO_STATUS.map((s) => (
          <div key={s.value} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{counts[s.value] ?? 0}</div>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng khối lượng đặt</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {formatNumber(Math.round(totalWeight))} kg
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th>Dự án</Th>
              <Th>Đơn hàng</Th>
              <Th className="text-center">Loại</Th>
              <Th>Nhà cung cấp</Th>
              <Th className="text-center">Trạng thái</Th>
              <Th className="text-right">Số dòng</Th>
              <Th className="text-right">Giá trị</Th>
              <Th className="text-right">KL (kg)</Th>
              <Th>Ngày đặt</Th>
              <Th>File</Th>
            </tr>
          </THead>
          <tbody>
            {orders.map((o) => {
              const cat = PO_CATEGORY_MAP[o.category];
              const st = PO_STATUS_MAP[o.status];
              return (
                <Tr key={o.id}>
                  <Td className="font-medium">
                    <Link
                      href={`/projects/${o.project.id}/purchase`}
                      className="text-blue-600 hover:underline"
                    >
                      <span className="font-mono">{o.project.code}</span> {o.project.name}
                    </Link>
                  </Td>
                  <Td className="text-slate-600">{o.orderNo ?? "—"}</Td>
                  <Td className="text-center">
                    <Badge tone={cat?.tone ?? "slate"}>{cat?.label ?? o.category}</Badge>
                  </Td>
                  <Td className="text-slate-700">{o.supplier?.name ?? "—"}</Td>
                  <Td className="text-center">
                    <Badge tone={st?.tone ?? "slate"}>{st?.label ?? o.status}</Badge>
                  </Td>
                  <Td className="text-right">{o._count.items}</Td>
                  <Td className="text-right">{o.value ? formatVND(o.value) : "—"}</Td>
                  <Td className="text-right">{formatNumber(o.totalWeight)}</Td>
                  <Td className="text-slate-500">{o.orderDate ? formatDate(o.orderDate) : "—"}</Td>
                  <Td>
                    {o.filePath ? (
                      <a
                        href={`/api/purchases/${o.id}/file`}
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
          </tbody>
        </Table>
      </div>
    </div>
  );
}
