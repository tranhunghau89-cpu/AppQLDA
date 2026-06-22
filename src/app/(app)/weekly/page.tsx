import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { isoWeek, weekLabel, recentWeeks } from "@/lib/week";
import { WeeklyBoard, type WeeklyProjectRow, type WeekCol } from "./WeeklyBoard";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const session = await requireSession();
  const canEdit = can(session.role, "progress", "edit");

  const sp = await searchParams;
  const now = isoWeek(new Date());
  let year = sp.year ? Number(sp.year) : now.year;
  let week = sp.week ? Number(sp.week) : now.week;
  if (!Number.isFinite(week) || week < 1) {
    week = 52;
    year -= 1;
  }
  if (week > 53) {
    week = 1;
    year += 1;
  }

  const current: WeekCol = { year, week, label: weekLabel(year, week) };
  const prev = recentWeeks(year, week - 1, 3).map((w) => ({
    ...w,
    label: weekLabel(w.year, w.week),
  }));
  const allCols = [current, ...prev];

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      weeklyLogs: {
        where: {
          OR: allCols.map((c) => ({ year: c.year, week: c.week })),
        },
        select: { year: true, week: true, note: true },
      },
    },
  });

  const rows: WeeklyProjectRow[] = projects.map((p) => {
    const notes: Record<string, string> = {};
    for (const log of p.weeklyLogs) {
      notes[`${log.year}-${log.week}`] = log.note ?? "";
    }
    return { id: p.id, code: p.code, name: p.name, status: p.status, notes };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tiến độ tuần</h1>
        <p className="text-sm text-slate-500">
          Nhật ký tiến độ theo tuần cho từng dự án
        </p>
      </div>
      <WeeklyBoard
        current={current}
        prevWeeks={prev}
        selected={{ year, week }}
        projects={rows}
        canEdit={canEdit}
      />
    </div>
  );
}
