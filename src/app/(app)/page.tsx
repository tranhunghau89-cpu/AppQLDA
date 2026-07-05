import Link from "next/link";
import { FolderKanban, Hammer, CheckCircle2, TrendingUp, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROJECT_STATUS, MILESTONE_TYPE_MAP } from "@/lib/constants";
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
      costSummary: { select: { revenue: true, cost: true } },
      milestones: { select: { type: true, done: true, planDate: true } },
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
    // Ưu tiên quyết toán thực tế (THCP) nếu có, ngược lại tính từ dự toán.
    let sale: number;
    let cost: number;
    if (p.costSummary) {
      sale = p.costSummary.revenue ?? p.salePrice ?? 0;
      cost = p.costSummary.cost ?? 0;
    } else {
      const s = computeProfit(p.estimateItems, p.salePrice, p.area);
      sale = s.salePrice;
      cost = s.totalCost;
    }
    totalRevenue += sale;
    totalCost += cost;
    return { code: p.code, cost, sale };
  });
  const totalProfit = totalRevenue - totalCost;
  const topCostSale = [...costSale]
    .sort((a, b) => b.sale - a.sale)
    .slice(0, 6)
    .reverse();

  // Mốc trễ hạn: chưa xong mà quá ngày kế hoạch
  const nowTs = Date.now();
  const lateItems: { code: string; id: string; type: string; days: number }[] = [];
  for (const p of projects) {
    for (const m of p.milestones) {
      if (!m.done && m.planDate && m.planDate.getTime() < nowTs) {
        lateItems.push({
          code: p.code,
          id: p.id,
          type: m.type,
          days: Math.floor((nowTs - m.planDate.getTime()) / 86400000),
        });
      }
    }
  }
  lateItems.sort((a, b) => b.days - a.days);

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

      {lateItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Mốc trễ hạn ({lateItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lateItems.slice(0, 12).map((it, i) => (
                <Link
                  key={i}
                  href={`/projects/${it.id}`}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  <span className="font-mono font-semibold">{it.code}</span> ·{" "}
                  {MILESTONE_TYPE_MAP[it.type]?.label ?? it.type} —{" "}
                  <span className="font-semibold">trễ {it.days} ngày</span>
                </Link>
              ))}
              {lateItems.length > 12 && (
                <span className="px-2 py-1.5 text-sm text-slate-400">
                  +{lateItems.length - 12} mốc khác
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
