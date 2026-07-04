"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addProjectNote, deleteProjectNote } from "../actions";

export interface NoteItem {
  id: string;
  content: string;
  authorName: string | null;
  createdAt: string; // ISO
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi} ${dd}/${mm}/${d.getFullYear()}`;
}

export function ProjectNotes({
  projectId,
  notes,
  canEdit,
  canDelete,
}: {
  projectId: string;
  notes: NoteItem[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const content = ref.current?.value ?? "";
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addProjectNote(projectId, content);
      if (!res.ok) setError(res.error);
      else if (ref.current) ref.current.value = "";
    });
  };

  const remove = (noteId: string) => {
    if (!confirm("Xóa ghi chú này?")) return;
    startTransition(async () => {
      const res = await deleteProjectNote(noteId, projectId);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="space-y-2">
          <textarea
            ref={ref}
            rows={2}
            placeholder="Ghi chú tiến độ, vướng mắc, chỉ đạo... (thời gian được lưu tự động)"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : <span />}
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Đang lưu..." : "Thêm ghi chú"}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có ghi chú nào.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-4">
          {notes.map((n) => (
            <li key={n.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-400" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                    {n.authorName ? ` · ${n.authorName}` : ""}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{n.content}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(n.id)}
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
    </div>
  );
}
