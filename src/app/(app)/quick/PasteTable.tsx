"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PasteColumn {
  key: string;
  label: string;
  kind?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  /** Chuẩn hóa text dán vào → giá trị lưu (mặc định: select tự khớp value/label). */
  normalize?: (raw: string) => string;
  placeholder?: string;
}

export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function normalizeCell(col: PasteColumn, raw: string): string {
  if (col.normalize) return col.normalize(raw);
  if (col.kind === "select" && col.options) {
    const k = strip(raw);
    const hit = col.options.find((o) => strip(o.value) === k || strip(o.label) === k);
    return hit?.value ?? raw.trim();
  }
  return raw.trim();
}

export function PasteTable({
  columns,
  requiredKey,
  onConfirm,
  hint,
}: {
  columns: PasteColumn[];
  requiredKey: string;
  onConfirm: (rows: Record<string, string>[]) => Promise<BulkResult>;
  hint?: string;
}) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function parse() {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
    const parsed = lines.map((line) => {
      const cells = line.split("\t");
      const row: Record<string, string> = {};
      columns.forEach((c, i) => {
        row[c.key] = normalizeCell(c, cells[i] ?? "");
      });
      return row;
    });
    setRows(parsed);
    setErr(parsed.length === 0 ? "Không tách được dòng nào. Copy vùng ô từ Excel rồi dán vào." : null);
    setMsg(null);
  }

  function update(i: number, key: string, v: string) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }

  const validRows = rows.filter((r) => (r[requiredKey] ?? "").trim());

  function confirm() {
    if (validRows.length === 0) {
      setErr("Không có dòng hợp lệ để nhập.");
      return;
    }
    setErr(null);
    start(async () => {
      const res = await onConfirm(validRows);
      if (!res.ok) setErr(res.error);
      else {
        setMsg(`✓ Đã nhập ${res.count} dòng.`);
        setRows([]);
        setRaw("");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-slate-500">
          {hint ?? "Copy vùng ô trong Excel rồi dán vào đây. Cột theo thứ tự:"}{" "}
          <span className="font-medium text-slate-600">{columns.map((c) => c.label).join(" · ")}</span>
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder="Dán từ Excel vào đây…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={parse} disabled={!raw.trim()}>
            Xem trước
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium text-slate-500">
                      {c.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const invalid = !(row[requiredKey] ?? "").trim();
                  return (
                    <tr key={i} className={invalid ? "bg-red-50" : "even:bg-slate-50/50"}>
                      {columns.map((c) => (
                        <td key={c.key} className="px-1 py-0.5">
                          {c.kind === "select" && c.options ? (
                            <select
                              value={row[c.key] ?? ""}
                              onChange={(e) => update(i, c.key, e.target.value)}
                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                            >
                              {c.options.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={row[c.key] ?? ""}
                              onChange={(e) => update(i, c.key, e.target.value)}
                              placeholder={c.placeholder}
                              className="w-full min-w-24 rounded border border-slate-200 px-1.5 py-1 text-xs"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-1 text-center">
                        <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button disabled={pending || validRows.length === 0} onClick={confirm}>
            {pending ? "Đang nhập…" : `Xác nhận nhập ${validRows.length} dòng`}
          </Button>
        </div>
      )}

      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      {msg && !err && <p className="text-sm text-green-600">{msg}</p>}
    </div>
  );
}
