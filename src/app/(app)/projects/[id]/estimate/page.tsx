import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { EstimateEditor, type EstimateRow } from "./EstimateEditor";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireView("estimate");
  const canEdit = can(session.role, "estimate", "edit");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      estimateItems: {
        include: { supplier: { select: { name: true } } },
        orderBy: [{ groupCode: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!project) notFound();

  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rows: EstimateRow[] = project.estimateItems.map((it) => ({
    id: it.id,
    groupCode: it.groupCode,
    name: it.name,
    unit: it.unit,
    designQty: it.designQty,
    actualQty: it.actualQty,
    unitPrice: it.unitPrice,
    amount: it.amount,
    supplierId: it.supplierId,
    supplierName: it.supplier?.name ?? null,
    orderStatus: it.orderStatus,
    dispatchStatus: it.dispatchStatus,
    note: it.note,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dự toán — <span className="font-mono">{project.code}</span> {project.name}
          </h1>
          <p className="text-sm text-slate-500">Chi phí, đơn giá, nhà cung cấp và lợi nhuận</p>
        </div>
        <a
          href={`/api/export/estimate/${project.id}`}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Xuất Excel
        </a>
      </div>

      <EstimateEditor
        projectId={project.id}
        items={rows}
        suppliers={suppliers}
        salePrice={project.salePrice}
        area={project.area}
        canEdit={canEdit}
      />
    </div>
  );
}
