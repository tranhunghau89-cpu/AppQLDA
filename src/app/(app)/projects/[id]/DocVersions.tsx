"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DOC_TYPE, DOC_TYPE_MAP, DOC_STATUS, DOC_STATUS_MAP } from "@/lib/constants";
import { addDocVersion, deleteDocVersion } from "../actions";

export interface DocVersionItem {
  id: string;
  docType: string;
  version: string;
  issuedAt: string | null; // ISO
  status: string;
  note: string | null;
  authorName: string | null;
  createdAt: string; // ISO
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function DocVersions({
  projectId,
  docs,
  canEditTypes,
  canDelete,
}: {
  projectId: string;
  docs: DocVersionItem[];
  canEditTypes: string[];
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (form: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await addDocVersion(projectId, form);
      if (!res.ok) setError(res.error);
      else formRef.current?.reset();
    });
  };

  const remove = (docId: string) => {
    if (!confirm("Xóa phiên bản hồ sơ này?")) return;
    startTransition(async () => {
      const res = await deleteDocVersion(docId, projectId);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-5">
      {canEditTypes.length > 0 && (
        <form
          ref={formRef}
          action={submit}
          className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-6"
        >
          <select
            name="docType"
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {DOC_TYPE.filter((t) => canEditTypes.includes(t.value)).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            name="version"
            placeholder="Phiên bản (R0...)"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            required
          />
          <input
            name="issuedAt"
            type="date"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            title="Ngày phát hành / gửi"
          />
          <select
            name="status"
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {DOC_STATUS.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
          <input
            name="note"
            placeholder="Ghi chú"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Đang lưu..." : "Thêm phiên bản"}
          </button>
          {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {DOC_TYPE.map((t) => {
          const list = docs.filter((d) => d.docType === t.value);
          return (
            <div key={t.value} className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 px-3 py-2">
                <Badge tone={t.tone ?? "slate"}>{t.label}</Badge>
                <span className="ml-2 text-xs text-slate-400">{list.length} phiên bản</span>
              </div>
              <div className="divide-y divide-slate-50">
                {list.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-300">Chưa có</p>
                ) : (
                  list.map((d) => {
                    const st = DOC_STATUS_MAP[d.status];
                    return (
                      <div key={d.id} className="flex items-start justify-between gap-2 px-3 py-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-800">
                              {d.version}
                            </span>
                            <Badge tone={st?.tone ?? "slate"}>{st?.label ?? d.status}</Badge>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {fmtDate(d.issuedAt)}
                            {d.authorName ? ` · ${d.authorName}` : ""}
                          </div>
                          {d.note && <p className="mt-0.5 text-sm text-slate-600">{d.note}</p>}
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => remove(d.id)}
                            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                            title="Xóa phiên bản"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
