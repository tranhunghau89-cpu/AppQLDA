import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND, formatDate, formatNumber } from "@/lib/utils";
import { StatusChanger, SupplierAssigner } from "./ProjectDetail";
import { Milestones, type MilestoneValue } from "./Milestones";
import { computeProfit, formatPercent } from "@/lib/profit";
import { Calculator } from "lucide-react";

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
      milestones: true,
      estimateItems: {
        select: {
          groupCode: true,
          designQty: true,
          actualQty: true,
          unitPrice: true,
          amount: true,
        },
      },
    },
  });
  if (!project) notFound();

  const canEditProgress = can(session.role, "progress", "edit");
  const canViewProfit = can(session.role, "profit", "view");
  const profit = computeProfit(project.estimateItems, project.salePrice, project.area);
  const milestoneMap: Record<string, MilestoneValue> = {};
  for (const m of project.milestones) {
    milestoneMap[m.type] = {
      planDate: m.planDate?.toISOString() ?? null,
      actualDate: m.actualDate?.toISOString() ?? null,
      done: m.done,
      note: m.note,
    };
  }

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dự toán & Chi phí</CardTitle>
          <Link
            href={`/projects/${project.id}/estimate`}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Calculator className="h-4 w-4" /> Mở dự toán
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Summary label="Tổng chi phí" value={formatVND(profit.totalCost)} />
            {canViewProfit && <Summary label="Giá bán" value={formatVND(profit.salePrice)} />}
            {canViewProfit && (
              <Summary
                label="Lợi nhuận"
                value={formatVND(profit.profit)}
                valueClass={profit.profit >= 0 ? "text-green-600" : "text-red-600"}
              />
            )}
            {canViewProfit && (
              <Summary label="Biên LN" value={formatPercent(profit.margin)} />
            )}
            {!canViewProfit && (
              <Summary
                label="CP / m²"
                value={profit.costPerM2 != null ? formatVND(profit.costPerM2) : "—"}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiến độ thực hiện</CardTitle>
        </CardHeader>
        <CardContent>
          <Milestones
            projectId={project.id}
            milestones={milestoneMap}
            canEdit={canEditProgress}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold text-slate-900 ${valueClass ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
