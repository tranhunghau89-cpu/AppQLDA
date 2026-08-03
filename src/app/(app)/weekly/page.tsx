import { db } from "@/lib/db";
import { requireView } from "@/lib/auth";
import { can, type Role } from "@/lib/rbac";
import { projectNoteDb, noteImageDb } from "@/lib/project-notes";
import { signedUrl } from "@/lib/storage";
import { docVersionDb } from "@/lib/doc-versions";
import { weekRange } from "@/lib/week";
import { MILESTONE_TYPE, DOC_TYPE_MAP, DOC_STATUS_MAP, PO_CATEGORY_MAP } from "@/lib/constants";
import { ProgressBoard, type ProgressRow, type TimelineEntry } from "./ProgressBoard";

function fmtDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi} ${dd}/${mm}/${d.getFullYear()}`;
}

export default async function ProgressPage() {
  const session = await requireView("progress");
  const canEdit = can(session.role as Role, "project", "edit");
  const canDelete = session.role === "ADMIN";

  const projects = await db.project.findMany({
    orderBy: { code: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      location: true,
      milestones: { select: { type: true, done: true, planDate: true, actualDate: true } },
      weeklyLogs: {
        orderBy: [{ year: "desc" }, { week: "desc" }],
        select: { year: true, week: true, note: true },
      },
    },
  });

  const allNotes = await projectNoteDb.findMany({ orderBy: { createdAt: "desc" } });
  const allNoteImgs = allNotes.length
    ? await noteImageDb.findMany({ where: { noteId: { in: allNotes.map((n) => n.id) } } })
    : [];
  const imgUrlByNote = new Map<string, string[]>();
  for (const im of allNoteImgs) {
    const url = await signedUrl(im.key);
    if (!url) continue;
    const list = imgUrlByNote.get(im.noteId) ?? [];
    list.push(url);
    imgUrlByNote.set(im.noteId, list);
  }
  const allDocs = await docVersionDb.findMany({ orderBy: [{ createdAt: "desc" }] });
  const docsByProject = new Map<string, typeof allDocs>();
  for (const d of allDocs) {
    const list = docsByProject.get(d.projectId) ?? [];
    list.push(d);
    docsByProject.set(d.projectId, list);
  }
  const allPos = await db.purchaseOrder.findMany({
    select: {
      id: true,
      projectId: true,
      orderNo: true,
      category: true,
      orderedDate: true,
      receivedDate: true,
      supplier: { select: { name: true } },
    },
  });
  const posByProject = new Map<string, typeof allPos>();
  for (const o of allPos) {
    const list = posByProject.get(o.projectId) ?? [];
    list.push(o);
    posByProject.set(o.projectId, list);
  }
  const notesByProject = new Map<string, typeof allNotes>();
  for (const n of allNotes) {
    const list = notesByProject.get(n.projectId) ?? [];
    list.push(n);
    notesByProject.set(n.projectId, list);
  }

  const rows: ProgressRow[] = projects.map((p) => {
    const doneTypes = p.milestones.filter((m) => m.done).map((m) => m.type);
    const now = Date.now();
    const lateTypes: Record<string, number> = {};
    for (const m of p.milestones) {
      if (!m.done && m.planDate && m.planDate.getTime() < now) {
        lateTypes[m.type] = Math.floor((now - m.planDate.getTime()) / 86400000);
      }
    }

    const noteEntries: TimelineEntry[] = (notesByProject.get(p.id) ?? []).map((n) => ({
      key: `note-${n.id}`,
      kind: "note" as const,
      noteId: n.id,
      dateIso: n.createdAt.toISOString(),
      label: fmtDateTime(n.createdAt),
      author: n.authorName,
      content: n.content,
      images: imgUrlByNote.get(n.id) ?? [],
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

    const docEntries: TimelineEntry[] = (docsByProject.get(p.id) ?? []).map((d) => {
      const when = d.issuedAt ?? d.createdAt;
      const typeLabel = DOC_TYPE_MAP[d.docType]?.label ?? d.docType;
      const stLabel = DOC_STATUS_MAP[d.status]?.label ?? d.status;
      return {
        key: `doc-${d.id}`,
        kind: "doc" as const,
        dateIso: when.toISOString(),
        label: fmtDateTime(when),
        author: d.authorName,
        content: `${typeLabel} ${d.version} — ${stLabel}${d.note ? `: ${d.note}` : ""}`,
      };
    });

    const poEntries: TimelineEntry[] = [];
    for (const o of posByProject.get(p.id) ?? []) {
      const catLabel = PO_CATEGORY_MAP[o.category]?.label ?? o.category;
      const name = o.orderNo ? `${catLabel} (${o.orderNo})` : catLabel;
      const ncc = o.supplier?.name ? ` — NCC: ${o.supplier.name}` : "";
      if (o.orderedDate) {
        poEntries.push({
          key: `po-order-${o.id}`,
          kind: "po" as const,
          dateIso: o.orderedDate.toISOString(),
          label: fmtDateTime(o.orderedDate),
          author: null,
          content: `Đặt hàng ${name}${ncc}`,
        });
      }
      if (o.receivedDate) {
        poEntries.push({
          key: `po-recv-${o.id}`,
          kind: "po" as const,
          dateIso: o.receivedDate.toISOString(),
          label: fmtDateTime(o.receivedDate),
          author: null,
          content: `Nhận hàng ${name}${ncc}`,
        });
      }
    }

    const timeline = [...noteEntries, ...weekEntries, ...docEntries, ...poEntries].sort(
      (a, b) => b.dateIso.localeCompare(a.dateIso)
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
      lateTypes,
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
      <ProgressBoard rows={rows} canEdit={canEdit} canDelete={canDelete} />
    </div>
  );
}
