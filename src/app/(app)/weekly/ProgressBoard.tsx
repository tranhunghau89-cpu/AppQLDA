"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_MAP, MILESTONE_TYPE_MAP } from "@/lib/constants";

export interface TimelineEntry {
  key: string;
  kind: "note" | "week";
  dateIso: string; // để sắp xếp
  label: string; // "10:35 04/07/2026" hoặc "Tuần 27/2026"
  author: string | null;
  content: string;
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
  latest: TimelineEntry | null;
  timeline: TimelineEntry[];
}

export function ProgressBoard({ rows }: { rows: ProgressRow[] }) {
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
  toggle,
}: {
  row: ProgressRow;
  st?: { label: string; tone?: "slate" | "blue" | "amber" | "green" | "red" | "purple" };
  isOpen: boolean;
  pct: number;
  toggle: () => void;
}) {
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
          <Badge tone={st?.tone ?? "slate"}>{st?.label ?? r.status}</Badge>
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
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {opt.label}
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
            {r.timeline.length === 0 ? (
              <p className="text-sm text-slate-400">
                Chưa có ghi chú — thêm ghi chú trong trang chi tiết dự án.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                {r.timeline.map((t) => (
                  <li key={t.key} className="relative">
                    <span
                      className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                        t.kind === "note" ? "bg-blue-400" : "bg-amber-400"
                      }`}
                    />
                    <div className="text-xs text-slate-400">
                      {t.label}
                      {t.author ? ` · ${t.author}` : ""}
                      {t.kind === "week" ? " · nhật ký tuần (cũ)" : ""}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{t.content}</p>
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
