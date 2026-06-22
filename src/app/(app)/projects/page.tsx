import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { ProjectList, type ProjectRow } from "./ProjectList";

export default async function ProjectsPage() {
  const session = await requireView("project");
  const canEdit = can(session.role, "project", "edit");

  const [projects, customers] = await Promise.all([
    db.project.findMany({
      orderBy: { code: "desc" },
      include: { customer: { select: { name: true } } },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    buildingType: p.buildingType,
    status: p.status,
    location: p.location,
    customerId: p.customerId,
    customerName: p.customer?.name ?? null,
    startDate: p.startDate?.toISOString() ?? null,
    endDate: p.endDate?.toISOString() ?? null,
    kK: p.kK,
    kL: p.kL,
    kH: p.kH,
    area: p.area,
    salePrice: p.salePrice,
    note: p.note,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dự án</h1>
        <p className="text-sm text-slate-500">Danh sách và quản lý dự án thi công</p>
      </div>
      <ProjectList projects={rows} customers={customers} canEdit={canEdit} />
    </div>
  );
}
