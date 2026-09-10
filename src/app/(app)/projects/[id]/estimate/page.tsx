import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireProjectView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { EstimateEditor, type EstimateRow, type SectionInfo } from "./EstimateEditor";
import type { TemplateForClient } from "./ApplyTemplate";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireProjectView("estimate", id);
  const canEdit = can(session.role, "estimate", "edit");

  // 3 truy vấn độc lập -> chạy song song (guard phân quyền đã xong ở trên).
  const [project, suppliers, templateRows] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        estimateItems: {
          include: { supplier: { select: { name: true } } },
          orderBy: [{ sortOrder: "asc" }],
        },
        estimateSections: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.estimateTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  if (!project) notFound();

  const templates: TemplateForClient[] = templateRows.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    lines: t.lines.map((l) => ({
      id: l.id,
      groupLabel: l.groupLabel,
      name: l.name,
      unit: l.unit,
      defaultUnitPrice: l.defaultUnitPrice,
      role: l.role,
      feedsParam: l.feedsParam,
      takesFromParam: l.takesFromParam,
      factor: l.factor,
      defaultQty: l.defaultQty,
      groupCode: l.groupCode,
      note: l.note,
      sortOrder: l.sortOrder,
    })),
  }));

  const sections: SectionInfo[] = project.estimateSections.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    sortOrder: s.sortOrder,
  }));

  const rows: EstimateRow[] = project.estimateItems.map((it) => ({
    id: it.id,
    sectionId: it.sectionId,
    groupLabel: it.groupLabel,
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
    sortOrder: it.sortOrder,
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
        sections={sections}
        templates={templates}
        suppliers={suppliers}
        salePrice={project.salePrice}
        area={project.area}
        canEdit={canEdit}
      />
    </div>
  );
}
