import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { projectNoteDb } from "@/lib/project-notes";
import { weekRange } from "@/lib/week";
import { MILESTONE_TYPE } from "@/lib/constants";
import { ProgressBoard, type ProgressRow, type TimelineEntry } from "./ProgressBoard";

function fmtDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi} ${dd}/${mm}/${d.getFullYear()}`;
}

export default async function ProgressPage() {
  await requireView("progress");

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      location: true,
      milestones: { select: { type: true, done: true } },
      weeklyLogs: {
        orderBy: [{ year: "desc" }, { week: "desc" }],
        select: { year: true, week: true, note: true },
      },
    },
  });

  const allNotes = await projectNoteDb.findMany({ orderBy: { createdAt: "desc" } });
  const notesByProject = new Map<string, typeof allNotes>();
  for (const n of allNotes) {
    const list = notesByProject.get(n.projectId) ?? [];
    list.push(n);
    notesByProject.set(n.projectId, list);
  }

  const rows: ProgressRow[] = projects.map((p) => {
    const doneTypes = p.milestones.filter((m) => m.done).map((m) => m.type);

    const noteEntries: TimelineEntry[] = (notesByProject.get(p.id) ?? []).map((n) => ({
      key: `note-${n.id}`,
      kind: "note" as const,
      dateIso: n.createdAt.toISOString(),
      label: fmtDateTime(n.createdAt),
      author: n.authorName,
      content: n.content,
    }));

    const weekEntries: TimelineEntry[] = p.weeklyLogs
      .filter((w) => (w.note ?? "").trim() !== "")
      .map((w) => ({
        key: `week-${w.year}-${w.week}`,
        kind: "week" as const,
        dateIso: weekRange(w.year, w.week).end.toISOString(),
        label: `Tuần ${w.week}/${w.year}`,
        author: null,
        content: w.note ?? "",
      }));

    const timeline = [...noteEntries, ...weekEntries].sort((a, b) =>
      b.dateIso.localeCompare(a.dateIso)
    );

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      location: p.location,
      milestoneDone: doneTypes.length,
      milestoneTotal: MILESTONE_TYPE.length,
      doneTypes,
      latest: timeline[0] ?? null,
      timeline,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tiến độ</h1>
        <p className="text-sm text-slate-500">
          Tình trạng, mốc công việc và nhật ký ghi chú của từng dự án — ghi chú được thêm
          trong trang chi tiết dự án
        </p>
      </div>
      <ProgressBoard rows={rows} />
    </div>
  );
}
