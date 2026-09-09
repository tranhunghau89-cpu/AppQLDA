import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { canAccessProject } from "@/lib/scope";
import { buildEstimateWorkbook, type ExportProject } from "@/lib/estimateExport";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session.role, "estimate", "view"))
    return new Response("Forbidden", { status: 403 });

  if (!(await canAccessProject(session, id)))
    return new Response("Not found", { status: 404 });

  const project = await db.project.findUnique({
    where: { id },
    include: {
      estimateItems: {
        include: { supplier: { select: { name: true } } },
        orderBy: [{ sortOrder: "asc" }],
      },
      estimateSections: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) return new Response("Not found", { status: 404 });

  const data: ExportProject = {
    code: project.code,
    name: project.name,
    salePrice: project.salePrice,
    area: project.area,
    sections: project.estimateSections.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      sortOrder: s.sortOrder,
    })),
    items: project.estimateItems.map((it) => ({
      sectionId: it.sectionId,
      groupLabel: it.groupLabel,
      groupCode: it.groupCode,
      name: it.name,
      unit: it.unit,
      designQty: it.designQty,
      actualQty: it.actualQty,
      unitPrice: it.unitPrice,
      amount: it.amount,
      note: it.note,
      sortOrder: it.sortOrder,
      supplierName: it.supplier?.name ?? null,
    })),
  };

  const wb = await buildEstimateWorkbook(data, {
    showProfit: can(session.role, "profit", "view"),
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="du-toan-${project.code}.xlsx"`,
    },
  });
}
