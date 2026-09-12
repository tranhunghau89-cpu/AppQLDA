import { db } from "@/lib/db";
import { Download } from "lucide-react";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { ProjectList, type ProjectRow } from "./ProjectList";

export default async function ProjectsPage() {
  const session = await requireView("project");
  const canEdit = can(session.role, "project", "edit");
  const where = await scopedProjectWhere(session);

  const [projects, customers, khuVucs] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { code: "desc" },
      include: { customer: { select: { name: true } } },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.khuVuc.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true },
    }),
  ]);

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    buildingType: p.buildingType,
    status: p.status,
    location: p.location,
    khuVucId: p.khuVucId,
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dự án</h1>
          <p className="text-sm text-slate-500">Danh sách và quản lý dự án thi công</p>
        </div>
        <a
          href="/api/export/projects"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Xuất Excel
        </a>
      </div>
      {rows.length === 0 && session.role !== "ADMIN" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Bạn chưa được phân công dự án nào. Liên hệ Ban giám đốc/Quản lý để được thêm vào
          dự án (mục <span className="font-medium">Thành viên dự án</span> trong trang chi
          tiết dự án).
        </div>
      )}
      <ProjectList
        projects={rows}
        customers={customers}
        khuVucs={khuVucs}
        canEdit={canEdit}
      />
    </div>
  );
}
