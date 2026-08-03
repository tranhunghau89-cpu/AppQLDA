"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import { addProjectNote, deleteProjectNote } from "../projects/actions";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_MAP, MILESTONE_TYPE_MAP } from "@/lib/constants";

export interface TimelineEntry {
  key: string;
  kind: "note" | "week" | "doc" | "po";
  noteId?: string;
  dateIso: string; // để sắp xếp
  label: string; // "10:35 04/07/2026" hoặc "Tuần 27/2026"
  author: string | null;
  content: string;
  images?: string[];
}

export interface ProgressRow {
  id: string;
  code: string;
  name: string;
  status: string;
  location: string | null;
  milestoneDone: number;
  milestoneTotal: number;
  doneTypes: string[];
  lateTypes: Record<string, number>;
  latest: TimelineEntry | null;
  timeline: TimelineEntry[];
}

export function ProgressBoard({
  rows,
  canEdit,
  canDelete,
}: {
  rows: ProgressRow[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Mã</th>
            <th className="px-3 py-2.5">Tên dự án</th>
            <th className="px-3 py-2.5">Trạng thái</th>
            <th className="px-3 py-2.5">Mốc công việc</th>
            <th className="px-3 py-2.5">Ghi chú mới nhất</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const st = PROJECT_STATUS_MAP[r.status];
            const isOpen = !!open[r.id];
            const pct =
              r.milestoneTotal > 0 ? Math.round((r.milestoneDone / r.milestoneTotal) * 100) : 0;
            return (
              <RowGroup
                key={r.id}
                row={r}
                st={st}
                isOpen={isOpen}
                pct={pct}
                canEdit={canEdit}
                canDelete={canDelete}
                toggle={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
              />
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-6 text-sm text-slate-400">Chưa có dự án nào.</p>
      )}
    </div>
  );
}

function RowGroup({
  row: r,
  st,
  isOpen,
  pct,
  canEdit,
  canDelete,
  toggle,
}: {
  row: ProgressRow;
  st?: { label: string; tone?: "slate" | "blue" | "amber" | "green" | "red" | "purple" };
  isOpen: boolean;
  pct: number;
  canEdit: boolean;
  canDelete: boolean;
  toggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = () => {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    if (!String(form.get("content") ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addProjectNote(r.id, form);
      if (!res.ok) setError(res.error);
      else formRef.current?.reset();
    });
  };

  const removeNote = (noteId: string) => {
    if (!confirm("Xóa ghi chú này?")) return;
    startTransition(async () => {
      const res = await deleteProjectNote(noteId, r.id);
      if (!res.ok) setError(res.error);
    });
  };
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={toggle}>
        <td className="px-3 py-2.5 text-slate-400">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-3 py-2.5 font-mono font-medium text-blue-600">{r.code}</td>
        <td className="px-3 py-2.5 font-medium text-slate-800">
          {r.name}
          {r.location ? <span className="ml-1.5 text-xs text-slate-400">· {r.location}</span> : null}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Badge tone={st?.tone ?? "slate"}>{st?.label ?? r.status}</Badge>
            {Object.keys(r.lateTypes).length > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                trễ {Object.keys(r.lateTypes).length} mốc
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-500">
              {r.milestoneDone}/{r.milestoneTotal}
            </span>
          </div>
        </td>
        <td className="max-w-[320px] px-3 py-2.5">
          {r.latest ? (
            <div>
              <div className="text-xs text-slate-400">
                {r.latest.label}
                {r.latest.author ? ` · ${r.latest.author}` : ""}
              </div>
              <div className="truncate text-slate-700">{r.latest.content}</div>
            </div>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/60">
          <td />
          <td colSpan={5} className="px-3 py-4">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {Object.entries(MILESTONE_TYPE_MAP).map(([type, opt]) => (
                <span
                  key={type}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.doneTypes.includes(type)
                      ? "bg-green-100 text-green-700"
                      : r.lateTypes[type] != null
                        ? "bg-red-100 font-medium text-red-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                  title={r.lateTypes[type] != null ? `Quá hạn kế hoạch ${r.lateTypes[type]} ngày` : undefined}
                >
                  {opt.label}
                  {r.lateTypes[type] != null ? ` (trễ ${r.lateTypes[type]}n)` : ""}
                </span>
              ))}
              <Link
                href={`/projects/${r.id}`}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Mở dự án <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            {canEdit && (
              <form ref={formRef} className="mb-3 space-y-2">
                <textarea
                  ref={inputRef}
                  name="content"
                  rows={2}
                  placeholder="Thêm ghi chú tiến độ... (thời gian lưu tự động, Ctrl+Enter để lưu)"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      name="images"
                      accept="image/*"
                      multiple
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:text-slate-600"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submit();
                    }}
                    disabled={pending}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {pending ? "Đang lưu..." : "Thêm ghi chú"}
                  </button>
                </div>
              </form>
            )}
            {r.timeline.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có ghi chú nào.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                {r.timeline.map((t) => (
                  <li key={t.key} className="relative">
                    <span
                      className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                        { note: "bg-blue-400", week: "bg-amber-400", doc: "bg-purple-400", po: "bg-green-500" }[t.kind]
                      }`}
                    />
                    <div className="text-xs text-slate-400">
                      {t.label}
                      {t.author ? ` · ${t.author}` : ""}
                      {t.kind === "week" ? " · nhật ký tuần (cũ)" : ""}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{t.content}</p>
                        {t.images && t.images.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {t.images.map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a key={i} href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                <img src={url} alt="Ảnh" className="h-16 w-16 rounded-md border border-slate-200 object-cover hover:opacity-80" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {canDelete && t.kind === "note" && t.noteId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNote(t.noteId!);
                          }}
                          className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                          title="Xóa ghi chú"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
