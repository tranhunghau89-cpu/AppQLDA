import Link from "next/link";
import { FolderKanban, Hammer, CheckCircle2, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROJECT_STATUS } from "@/lib/constants";
import { computeProfit } from "@/lib/profit";
import { formatVND, formatDate } from "@/lib/utils";
import { StatusChart, CostSaleChart } from "./DashboardCharts";

export default async function DashboardPage() {
  const session = await requireSession();
  const canViewProfit = can(session.role, "profit", "view");

  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { name: true } },
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

  const statusData = PROJECT_STATUS.map((s) => ({
    status: s.value,
    label: s.label,
    count: projects.filter((p) => p.status === s.value).length,
  }));

  const inProgress = projects.filter(
    (p) => p.status === "GIA_CONG" || p.status === "LAP_DUNG"
  ).length;
  const done = projects.filter((p) => p.status === "HOAN_THANH").length;

  let totalRevenue = 0;
  let totalCost = 0;
  const costSale = projects.map((p) => {
    const s = computeProfit(p.estimateItems, p.salePrice, p.area);
    totalRevenue += s.salePrice;
    totalCost += s.totalCost;
    return { code: p.code, cost: s.totalCost, sale: s.salePrice };
  });
  const totalProfit = totalRevenue - totalCost;
  const topCostSale = [...costSale]
    .sort((a, b) => b.sale - a.sale)
    .slice(0, 6)
    .reverse();

  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tổng quan</h1>
        <p className="text-sm text-slate-500">
          Xin chào {session.name} — bức tranh toàn cảnh dự án
        </p>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<FolderKanban />} label="Tổng dự án" value={String(projects.length)} tone="blue" />
        <StatCard icon={<Hammer />} label="Đang thi công" value={String(inProgress)} tone="amber" />
        <StatCard icon={<CheckCircle2 />} label="Hoàn thành" value={String(done)} tone="green" />
        {canViewProfit ? (
          <StatCard
            icon={<TrendingUp />}
            label="Lợi nhuận dự kiến"
            value={formatVND(totalProfit)}
            tone={totalProfit >= 0 ? "green" : "red"}
          />
        ) : (
          <StatCard
            icon={<TrendingUp />}
            label="Chờ / Shop"
            value={String(
              projects.filter((p) => p.status === "CHO" || p.status === "SHOP").length
            )}
            tone="slate"
          />
        )}
      </div>

      {canViewProfit && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent>
              <div className="text-sm text-slate-500">Tổng doanh thu (hợp đồng)</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-slate-500">Tổng chi phí dự toán</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">{formatVND(totalCost)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Biểu đồ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dự án theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChart data={statusData} />
          </CardContent>
        </Card>

        {canViewProfit && (
          <Card>
            <CardHeader>
              <CardTitle>Giá bán vs Chi phí (top dự án)</CardTitle>
            </CardHeader>
            <CardContent>
              <CostSaleChart data={topCostSale} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cập nhật gần đây */}
      <Card>
        <CardHeader>
          <CardTitle>Dự án cập nhật gần đây</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 py-0">
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between py-3 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium text-blue-600">{p.code}</span>
                <span className="text-slate-900">{p.name}</span>
                <span className="text-sm text-slate-400">
                  {p.customer?.name ?? "—"} · {p.location ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={p.status} />
                <span className="text-sm text-slate-400">{formatDate(p.updatedAt)}</span>
              </div>
            </Link>
          ))}
          {recent.length === 0 && (
            <p className="py-8 text-center text-slate-400">Chưa có dự án</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "amber" | "green" | "red" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
