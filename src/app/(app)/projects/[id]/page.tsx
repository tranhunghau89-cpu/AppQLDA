import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatDate, formatNumber } from "@/lib/utils";
import { StatusChanger, SupplierAssigner } from "./ProjectDetail";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const canEdit = can(session.role, "project", "edit");

  const project = await db.project.findUnique({
    where: { id },
    include: {
      customer: true,
      suppliers: { include: { supplier: true } },
    },
  });
  if (!project) notFound();

  const suppliers = await db.supplier.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });

  const assigned: Record<string, { id: string; name: string }> = {};
  for (const link of project.suppliers) {
    assigned[link.component] = { id: link.supplier.id, name: link.supplier.name };
  }

  const dim =
    project.kK || project.kL || project.kH
      ? `${formatNumber(project.kK)} × ${formatNumber(project.kL)} × ${formatNumber(project.kH)}`
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              <span className="font-mono">{project.code}</span> — {project.name}
            </h1>
            <p className="text-sm text-slate-500">
              {project.buildingType || "Công trình"} · {project.location || "—"}
            </p>
          </div>
        </div>
        <StatusChanger projectId={project.id} status={project.status} canEdit={canEdit} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin dự án</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 py-1">
            <InfoRow label="Chủ đầu tư" value={project.customer?.name ?? "—"} />
            <InfoRow label="Người phụ trách" value={project.customer?.contactPerson ?? "—"} />
            <InfoRow label="Điện thoại" value={project.customer?.phone ?? "—"} />
            <InfoRow label="Vị trí" value={project.location ?? "—"} />
            <InfoRow label="Kích thước (K×L×H)" value={dim} />
            <InfoRow label="Diện tích" value={`${formatNumber(project.area)} m²`} />
            <InfoRow label="Giá bán" value={project.salePrice ? formatVND(project.salePrice) : "—"} />
            <InfoRow label="Ngày bắt đầu" value={formatDate(project.startDate)} />
            <InfoRow label="Ngày hoàn thành" value={formatDate(project.endDate)} />
            {project.note && <InfoRow label="Ghi chú" value={project.note} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nhà cung cấp theo hạng mục</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierAssigner
              projectId={project.id}
              assigned={assigned}
              suppliers={suppliers}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
