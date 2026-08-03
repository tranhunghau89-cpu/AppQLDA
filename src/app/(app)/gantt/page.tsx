import Link from "next/link";
import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { MILESTONE_TYPE, PROJECT_STATUS_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

// Gantt toàn cảnh: mỗi dự án 1 hàng, các mốc kế hoạch/thực tế vẽ trên trục thời gian.
export default async function GanttPage() {
  await requireView("progress");

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      milestones: {
        select: { type: true, planDate: true, actualDate: true, done: true },
      },
    },
  });

  // Miền thời gian: min/max mọi ngày liên quan, đệm 15 ngày 2 đầu.
  let min = Infinity;
  let max = -Infinity;
  for (const p of projects) {
    for (const d of [p.startDate, p.endDate]) {
      if (d) {
        min = Math.min(min, d.getTime());
        max = Math.max(max, d.getTime());
      }
    }
    for (const m of p.milestones) {
      for (const d of [m.planDate, m.actualDate]) {
        if (d) {
          min = Math.min(min, d.getTime());
          max = Math.max(max, d.getTime());
        }
      }
    }
  }
  const now = Date.now();
  if (!Number.isFinite(min)) {
    min = now - 90 * 86400000;
    max = now + 90 * 86400000;
  }
  min -= 15 * 86400000;
  max += 15 * 86400000;
  const span = max - min;
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - min) / span) * 100));

  // Cột mốc tháng cho trục thời gian.
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < max) {
    months.push({
      label: `${String(cursor.getMonth() + 1).padStart(2, "0")}/${cursor.getFullYear()}`,
      left: pos(cursor.getTime()),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Kế hoạch (Gantt)</h1>
        <p className="text-sm text-slate-500">
          Toàn cảnh thời gian các dự án — thanh nền: từ ngày bắt đầu đến hoàn thành; chấm
          tròn: mốc công việc
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white" /> Kế hoạch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Đã xong
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Quá hạn (chưa xong)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-red-400" /> Hôm nay
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[760px]">
          {/* Trục tháng */}
          <div className="relative h-8 border-b border-slate-100 bg-slate-50">
            <div className="absolute inset-y-0 left-52 right-3">
              {months.map((m) => (
                <span
                  key={m.label}
                  className="absolute top-1.5 -translate-x-1/2 text-xs text-slate-400"
                  style={{ left: `${m.left}%` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {projects.map((p) => {
              const st = PROJECT_STATUS_MAP[p.status];
              return (
                <div key={p.id} className="flex items-center gap-0 px-3 py-2.5 hover:bg-slate-50/50">
                  <div className="w-49 shrink-0 pr-3" style={{ width: "13rem" }}>
                    <Link href={`/projects/${p.id}`} className="font-mono text-sm font-medium text-blue-600 hover:underline">
                      {p.code}
                    </Link>
                    <span className="ml-1.5 text-xs text-slate-500">{p.name}</span>
                    <div className="mt-0.5">
                      <Badge tone={st?.tone ?? "slate"}>{st?.label ?? p.status}</Badge>
                    </div>
                  </div>
                  <div className="relative h-9 flex-1">
                    {/* vạch tháng */}
                    {months.map((m) => (
                      <span
                        key={m.label}
                        className="absolute inset-y-0 w-px bg-slate-100"
                        style={{ left: `${m.left}%` }}
                      />
                    ))}
                    {/* vạch hôm nay */}
                    <span
                      className="absolute inset-y-0 w-0.5 bg-red-300"
                      style={{ left: `${pos(now)}%` }}
                    />
                    {/* thanh dự án */}
                    {p.startDate && (
                      <span
                        className="absolute top-3.5 h-2 rounded-full bg-slate-200"
                        style={{
                          left: `${pos(p.startDate.getTime())}%`,
                          width: `${Math.max(
                            0.5,
                            pos((p.endDate ?? new Date()).getTime()) - pos(p.startDate.getTime())
                          )}%`,
                        }}
                        title={`${formatDate(p.startDate)} → ${p.endDate ? formatDate(p.endDate) : "nay"}`}
                      />
                    )}
                    {/* các mốc */}
                    {MILESTONE_TYPE.map((mt) => {
                      const m = p.milestones.find((x) => x.type === mt.value);
                      if (!m) return null;
                      const marks: React.ReactNode[] = [];
                      if (m.planDate) {
                        const late = !m.done && m.planDate.getTime() < now;
                        marks.push(
                          <span
                            key={`plan-${mt.value}`}
                            className={`absolute top-3 h-3 w-3 -translate-x-1/2 rounded-full border-2 bg-white ${
                              late ? "border-red-500" : "border-blue-400"
                            }`}
                            style={{ left: `${pos(m.planDate.getTime())}%` }}
                            title={`${mt.label} — kế hoạch: ${formatDate(m.planDate)}${late ? " (QUÁ HẠN)" : ""}`}
                          />
                        );
                      }
                      if (m.done && (m.actualDate ?? m.planDate)) {
                        const d = (m.actualDate ?? m.planDate)!;
                        marks.push(
                          <span
                            key={`act-${mt.value}`}
                            className="absolute top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-green-500"
                            style={{ left: `${pos(d.getTime())}%` }}
                            title={`${mt.label} — hoàn thành: ${formatDate(d)}`}
                          />
                        );
                      }
                      return marks;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {projects.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400">Chưa có dự án nào.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Di chuột lên các chấm để xem tên mốc và ngày. Cập nhật ngày kế hoạch/thực tế trong
        trang chi tiết dự án → Tiến độ thực hiện.
      </p>
    </div>
  );
}
