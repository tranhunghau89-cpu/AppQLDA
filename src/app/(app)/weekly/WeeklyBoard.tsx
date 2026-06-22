"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { upsertWeeklyLog } from "./actions";

export interface WeekCol {
  year: number;
  week: number;
  label: string;
}

export interface WeeklyProjectRow {
  id: string;
  code: string;
  name: string;
  status: string;
  notes: Record<string, string>; // "year-week" -> note
}

function key(y: number, w: number) {
  return `${y}-${w}`;
}

function EditableCell({
  row,
  col,
}: {
  row: WeeklyProjectRow;
  col: WeekCol;
}) {
  const router = useRouter();
  const initial = row.notes[key(col.year, col.week)] ?? "";
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = value !== initial;

  function save() {
    if (!dirty) return;
    start(async () => {
      const res = await upsertWeeklyLog(row.id, col.year, col.week, value, row.status);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      disabled={pending}
      rows={2}
      placeholder="Ghi chú tuần…"
      className={`w-full resize-none rounded-md border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        dirty ? "border-blue-400 bg-blue-50/40" : "border-slate-200"
      }`}
    />
  );
}

export function WeeklyBoard({
  current,
  prevWeeks,
  selected,
  projects,
  canEdit,
}: {
  current: WeekCol;
  prevWeeks: WeekCol[];
  selected: { year: number; week: number };
  projects: WeeklyProjectRow[];
  canEdit: boolean;
}) {
  const prevHref = `/weekly?year=${current.year}&week=${current.week - 1}`;
  const nextHref = `/weekly?year=${current.year}&week=${current.week + 1}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={prevHref}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-56 text-center text-sm font-semibold text-slate-900">
          {current.label}
        </div>
        <Link
          href={nextHref}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
        <span className="ml-auto text-sm text-slate-500">{projects.length} dự án</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table>
          <THead>
            <tr>
              <Th className="w-40">Dự án</Th>
              <Th className="w-28">Trạng thái</Th>
              <Th className="min-w-64">{current.label}</Th>
              {prevWeeks.map((w) => (
                <Th key={key(w.year, w.week)} className="min-w-48">
                  {w.label}
                </Th>
              ))}
            </tr>
          </THead>
          <tbody>
            {projects.map((p) => (
              <Tr key={p.id}>
                <Td className="align-top">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-mono font-medium text-blue-600 hover:underline"
                  >
                    {p.code}
                  </Link>
                  <div className="text-xs text-slate-500">{p.name}</div>
                </Td>
                <Td className="align-top">
                  <StatusBadge status={p.status} />
                </Td>
                <Td className="align-top">
                  {canEdit ? (
                    <EditableCell row={p} col={current} />
                  ) : (
                    <span className="text-sm">{p.notes[key(current.year, current.week)] ?? "—"}</span>
                  )}
                </Td>
                {prevWeeks.map((w) => (
                  <Td key={key(w.year, w.week)} className="align-top text-sm text-slate-500">
                    {p.notes[key(w.year, w.week)] ?? "—"}
                  </Td>
                ))}
              </Tr>
            ))}
            {projects.length === 0 && (
              <Tr>
                <Td colSpan={3 + prevWeeks.length} className="py-8 text-center text-slate-400">
                  Chưa có dự án
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
