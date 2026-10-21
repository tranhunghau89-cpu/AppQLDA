import { db } from "@/lib/db";
import Link from "next/link";
import { Download, Gauge } from "lucide-react";
import { requireView } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedProjectWhere } from "@/lib/scope";
import { ProjectList, type ProjectRow } from "./ProjectList";
import { TabTrang, TAB_DU_AN } from "@/components/layout/TabTrang";

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
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
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
      <TabTrang tabs={TAB_DU_AN} hienTai="/projects" role={session.role} />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dự án</h1>
          <p className="text-sm text-slate-500">
            Danh sách và quản lý dự án thi công
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/projects/tong-quan"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Gauge className="h-4 w-4" /> Tổng quan
          </Link>
          <a
            href="/api/export/projects"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Xuất Excel
          </a>
        </div>
      </div>
      <ProjectList
        projects={rows}
        customers={customers}
        khuVucs={khuVucs}
        canEdit={canEdit}
      />
    </div>
  );
}
