import Link from "next/link";
import { FolderKanban, Hammer, CheckCircle2, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { scopedByProjectWhere, scopedProjectWhere } from "@/lib/scope";
import { serverNow } from "@/lib/now";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROJECT_STATUS, MILESTONE_TYPE, MILESTONE_TYPE_MAP } from "@/lib/constants";
import { computeProfit } from "@/lib/profit";
import { formatVND, formatDate } from "@/lib/utils";
import { StatusChart, CostSaleChart } from "./DashboardCharts";
import { paymentDb } from "@/lib/payments";

export default async function DashboardPage() {
  const session = await requireSession();
  const canViewProfit = can(session.role, "profit", "view");

  const canViewDebt = can(session.role, "debt", "view");
  const nowTs = serverNow();
  const where = await scopedProjectWhere(session);
  const inScope = await scopedByProjectWhere(session);

  // Trước đây: 1 findMany + 4 `include`. Prisma nạp các quan hệ khá tuần tự nên
  // trang này tốn ~2,6 round-trip. Tách thành các truy vấn rời chạy song song còn
  // ~1,4 round-trip (đo được: 864ms -> 465ms từ máy ở VN tới DB Tokyo).
  //
  // Có thử cả cách đưa phép cộng vào SQL bằng groupBy: 457ms — KHÔNG nhanh hơn
  // đáng kể, mà lại phải chép logic của computeAmount() sang SQL. Nên giữ nguyên
  // hàm thuần đã có test làm nguồn chân lý duy nhất.
  const [rawProjects, estimateItems, costSummaries, openMilestones, doneMilestones, pays] =
    await Promise.all([
    db.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        location: true,
        salePrice: true,
        area: true,
        updatedAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.estimateItem.findMany({
      where: inScope,
      select: {
        projectId: true,
        groupCode: true,
        designQty: true,
        actualQty: true,
        unitPrice: true,
        amount: true,
      },
    }),
    db.costSummary.findMany({
      where: inScope,
      select: { projectId: true, revenue: true, cost: true },
    }),
    // Chỉ mốc CHƯA xong mới có thể trễ hạn — lọc ngay ở DB thay vì nạp hết về.
    db.milestone.findMany({
      where: { ...inScope, done: false, planDate: { lt: new Date(nowTs) } },
      select: { projectId: true, type: true, planDate: true },
    }),
    // Chỉ cần SỐ mốc đã xong (để vẽ thanh tiến độ), không cần từng dòng.
    db.milestone.groupBy({
      by: ["projectId"],
      where: { ...inScope, done: true },
      _count: { _all: true },
    }),
    canViewDebt ? paymentDb.findMany({ where: inScope }) : Promise.resolve([]),
  ]);

  // Gom dữ liệu con về từng dự án (thay cho `include`).
  const itemsByProject = new Map<string, typeof estimateItems>();
  for (const it of estimateItems) {
    const list = itemsByProject.get(it.projectId) ?? [];
    list.push(it);
    itemsByProject.set(it.projectId, list);
  }
  const costByProject = new Map(costSummaries.map((c) => [c.projectId, c]));
  const doneCountByProject = new Map(doneMilestones.map((m) => [m.projectId, m._count._all]));

  const projects = rawProjects.map((p) => ({
    ...p,
    estimateItems: itemsByProject.get(p.id) ?? [],
    costSummary: costByProject.get(p.id) ?? null,
  }));

  const statusData = PROJECT_STATUS.map((s) => ({
    status: s.value,
    label: s.label,
    count: projects.filter((p) => p.status === s.value).length,
  }));

  const inProgress = projects.filter(
    (p) => p.status === "GIA_CONG" || p.status === "LAP_DUNG"
  ).length;
  const done = projects.filter((p) => p.status === "HOAN_THANH").length;

  const costSale = projects.map((p) => {
    // Ưu tiên quyết toán thực tế (THCP) nếu có, ngược lại tính từ dự toán.
    if (p.costSummary) {
      return {
        code: p.code,
        sale: p.costSummary.revenue ?? p.salePrice ?? 0,
        cost: p.costSummary.cost ?? 0,
      };
    }
    const s = computeProfit(p.estimateItems, p.salePrice, p.area);
    return { code: p.code, sale: s.salePrice, cost: s.totalCost };
  });
  const totalRevenue = costSale.reduce((s, x) => s + x.sale, 0);
  const totalCost = costSale.reduce((s, x) => s + x.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const topCostSale = [...costSale]
    .sort((a, b) => b.sale - a.sale)
    .slice(0, 6)
    .reverse();

  // Mốc trễ hạn — `openMilestones` đã được DB lọc sẵn (chưa xong + quá hạn).
  const projectById = new Map(rawProjects.map((p) => [p.id, p]));
  const lateItems: { code: string; id: string; type: string; days: number }[] = [];
  for (const m of openMilestones) {
    const p = projectById.get(m.projectId);
    if (!p || !m.planDate) continue;
    lateItems.push({
      code: p.code,
      id: p.id,
      type: m.type,
      days: Math.floor((nowTs - m.planDate.getTime()) / 86400000),
    });
  }
  lateItems.sort((a, b) => b.days - a.days);

  // Dòng tiền từ các đợt thanh toán
  const cash = { thuPlan: 0, thuPaid: 0, chiPlan: 0, chiPaid: 0, dueSoon: 0, overdue: 0 };
  {
    const soon = nowTs + 14 * 86400000;
    for (const x of pays) {
      const plan = x.amount ?? 0;
      if (x.direction === "THU") {
        cash.thuPlan += plan;
        cash.thuPaid += x.paidDate ? (x.paidAmount ?? plan) : 0;
      } else {
        cash.chiPlan += plan;
        cash.chiPaid += x.paidDate ? (x.paidAmount ?? plan) : 0;
      }
      if (!x.paidDate && x.dueDate) {
        if (x.dueDate.getTime() < nowTs) cash.overdue += 1;
        else if (x.dueDate.getTime() < soon) cash.dueSoon += 1;
      }
    }
  }
  const hasCash = cash.thuPlan + cash.chiPlan + cash.thuPaid + cash.chiPaid > 0;

  const recent = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tổng quan</h1>
          <p className="text-sm text-slate-500">
            Xin chào {session.name} — bức tranh toàn cảnh dự án
          </p>
        </div>
        <a
          href="/api/reports/summary"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Xuất báo cáo Excel
        </a>
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

      {canViewDebt && hasCash && (
        <Card>
          <CardHeader>
            <CardTitle>Dòng tiền (theo đợt thanh toán)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Đã thu / KH thu</div>
                <div className="font-semibold text-blue-600">
                  {formatVND(cash.thuPaid)}
                  <span className="text-xs font-normal text-slate-400"> / {formatVND(cash.thuPlan)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Đã chi / KH chi</div>
                <div className="font-semibold text-amber-600">
                  {formatVND(cash.chiPaid)}
                  <span className="text-xs font-normal text-slate-400"> / {formatVND(cash.chiPlan)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Đến hạn 14 ngày tới</div>
                <div className="font-semibold text-slate-900">{cash.dueSoon} đợt</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">Quá hạn</div>
                <div className={`font-semibold ${cash.overdue > 0 ? "text-red-600" : "text-green-600"}`}>
                  {cash.overdue} đợt
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                {(() => {
                  const doneCount = doneCountByProject.get(p.id) ?? 0;
                  const pct = Math.round((doneCount / MILESTONE_TYPE.length) * 100);
                  return (
                    <span className="flex items-center gap-2" title={`${doneCount}/${MILESTONE_TYPE.length} mốc hoàn thành`}>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-green-500"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-xs font-medium text-slate-500">{pct}%</span>
                    </span>
                  );
                })()}
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
