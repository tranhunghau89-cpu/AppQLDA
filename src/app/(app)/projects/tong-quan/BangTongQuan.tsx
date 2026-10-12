"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { PROJECT_STATUS, PROJECT_STATUS_MAP } from "@/lib/constants";
import { formatVND } from "@/lib/utils";
import type { MucCo } from "@/lib/projectHealth";

export interface TongQuanRow {
  id: string;
  code: string;
  name: string;
  customerName: string | null;
  status: string;
  muc: MucCo;
  lyDo: string[];
  tienDo: number;
  daThu: number | null;
  giaTriHD: number | null;
  conPhaiThu: number | null;
}

type Loc = "ALL" | "DO" | "VANG" | "CO";
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const CHAM: Record<string, string> = {
  DO: "bg-red-500",
  VANG: "bg-amber-400",
  OK: "bg-green-500",
};
const NUT: [Loc, string][] = [
  ["ALL", "Tất cả"],
  ["DO", "Cờ đỏ"],
  ["VANG", "Cờ vàng"],
  ["CO", "Có cờ"],
];

export function BangTongQuan({
  rows,
  hienTien,
}: {
  rows: TongQuanRow[];
  hienTien: boolean;
}) {
  const [loc, setLoc] = useState<Loc>("ALL");
  const [trangThai, setTrangThai] = useState("");

  const dem = useMemo(
    () => ({
      ALL: rows.length,
      DO: rows.filter((r) => r.muc === "DO").length,
      VANG: rows.filter((r) => r.muc === "VANG").length,
      CO: rows.filter((r) => r.muc).length,
    }),
    [rows],
  );
  const hien = rows.filter(
    (r) =>
      (loc === "ALL" || (loc === "CO" ? r.muc !== null : r.muc === loc)) &&
      (!trangThai || r.status === trangThai),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {NUT.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setLoc(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              loc === k
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label} ({dem[k]})
          </button>
        ))}
        <Select
          className="w-48"
          value={trangThai}
          onChange={(e) => setTrangThai(e.target.value)}
        >
          <option value="">Mọi giai đoạn</option>
          {PROJECT_STATUS.filter((o) => o.value !== "HOAN_THANH").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Dự án</th>
              <th className="px-3 py-2">CĐT</th>
              <th className="px-3 py-2">Giai đoạn</th>
              <th className="px-3 py-2">Tiến độ</th>
              {hienTien && <th className="px-3 py-2">Đã thu</th>}
              {hienTien && <th className="px-3 py-2 text-right">Giá trị HĐ</th>}
              {hienTien && (
                <th className="px-3 py-2 text-right">Còn phải thu</th>
              )}
              <th className="px-3 py-2">Lý do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hien.length === 0 && (
              <tr>
                <td
                  colSpan={hienTien ? 9 : 6}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  Không có dự án nào khớp bộ lọc
                </td>
              </tr>
            )}
            {hien.map((r) => {
              const st = PROJECT_STATUS_MAP[r.status];
              const href = `/projects/${r.id}#tong-quan`;
              const cell = (c: React.ReactNode, cls = "") => (
                <td className={`px-3 py-2 ${cls}`}>
                  <Link href={href} className="block">
                    {c}
                  </Link>
                </td>
              );
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  {cell(
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${CHAM[r.muc ?? "OK"]}`}
                    />,
                  )}
                  {cell(
                    <>
                      <span className="font-mono">{r.code}</span>{" "}
                      <span className="text-slate-600">{r.name}</span>
                    </>,
                  )}
                  {cell(r.customerName ?? "—")}
                  {cell(
                    <Badge tone={st?.tone ?? "slate"}>
                      {st?.label ?? r.status}
                    </Badge>,
                  )}
                  {cell(
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded bg-slate-200">
                        <div
                          className="h-1.5 rounded bg-blue-500"
                          style={{ width: `${r.tienDo * 100}%` }}
                        />
                      </div>
                      {pct(r.tienDo)}
                    </div>,
                  )}
                  {hienTien && cell(pct(r.daThu))}
                  {hienTien &&
                    cell(
                      r.giaTriHD != null ? formatVND(r.giaTriHD) : "—",
                      "text-right whitespace-nowrap",
                    )}
                  {hienTien &&
                    cell(
                      formatVND(r.conPhaiThu),
                      "text-right whitespace-nowrap",
                    )}
                  {cell(
                    <span
                      title={r.lyDo.join("\n")}
                      className={
                        r.muc === "DO" ? "text-red-700" : "text-amber-700"
                      }
                    >
                      {r.lyDo[0] ?? ""}
                      {r.lyDo.length > 1 && (
                        <span className="text-slate-400">
                          {" "}
                          (+{r.lyDo.length - 1})
                        </span>
                      )}
                    </span>,
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
