"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import {
  MILESTONE_TYPE,
  MILESTONE_TYPE_MAP,
  QC_KET_QUA_MAP,
} from "@/lib/constants";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export interface ViecQcRow {
  id: string;
  projectId: string;
  projectLabel: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  ketQua: string;
  ghiChu: string | null;
  han: string | null;
}

export function BangViecQc({
  rows,
  laAdmin,
}: {
  rows: ViecQcRow[];
  laAdmin: boolean;
}) {
  const [duAn, setDuAn] = useState("");
  const [giaiDoan, setGiaiDoan] = useState("");
  const [ketQua, setKetQua] = useState("");
  const [boPhan, setBoPhan] = useState("");

  const duAnList = [
    ...new Map(rows.map((r) => [r.projectId, r.projectLabel])).entries(),
  ];
  const hien = rows.filter(
    (r) =>
      (!duAn || r.projectId === duAn) &&
      (!giaiDoan || r.giaiDoan === giaiDoan) &&
      (!ketQua || r.ketQua === ketQua) &&
      (!boPhan || r.boPhan === boPhan),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          className="w-64"
          value={duAn}
          onChange={(e) => setDuAn(e.target.value)}
        >
          <option value="">Mọi dự án</option>
          {duAnList.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          value={giaiDoan}
          onChange={(e) => setGiaiDoan(e.target.value)}
        >
          <option value="">Mọi giai đoạn</option>
          {MILESTONE_TYPE.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={ketQua}
          onChange={(e) => setKetQua(e.target.value)}
        >
          <option value="">Chưa kiểm & không đạt</option>
          <option value="KHONG_DAT">Không đạt</option>
          <option value="CHUA">Chưa kiểm</option>
        </Select>
        {laAdmin && (
          <Select
            className="w-52"
            value={boPhan}
            onChange={(e) => setBoPhan(e.target.value)}
          >
            <option value="">Mọi bộ phận</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Dự án</th>
              <th className="px-3 py-2">Giai đoạn</th>
              <th className="px-3 py-2">Nội dung</th>
              <th className="px-3 py-2">Bộ phận</th>
              <th className="px-3 py-2">Kết quả</th>
              <th className="px-3 py-2">Hạn</th>
              <th className="px-3 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hien.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  Không có việc QC nào
                </td>
              </tr>
            )}
            {hien.map((r) => {
              const kq = QC_KET_QUA_MAP[r.ketQua];
              const href = `/projects/${r.projectId}#qc`;
              const cell = (c: React.ReactNode, cls = "") => (
                <td className={`px-3 py-2 ${cls}`}>
                  <Link href={href} className="block">
                    {c}
                  </Link>
                </td>
              );
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  {cell(r.projectLabel, "whitespace-nowrap font-mono text-xs")}
                  {cell(
                    MILESTONE_TYPE_MAP[r.giaiDoan]?.label ?? r.giaiDoan,
                    "whitespace-nowrap",
                  )}
                  {cell(r.noiDung)}
                  {cell(
                    ROLE_LABEL[r.boPhan as Role] ?? r.boPhan,
                    "whitespace-nowrap text-slate-600",
                  )}
                  {cell(
                    <Badge tone={kq?.tone ?? "slate"}>
                      {kq?.label ?? r.ketQua}
                    </Badge>,
                  )}
                  {cell(r.han ? formatDate(r.han) : "—", "whitespace-nowrap")}
                  {cell(r.ghiChu ?? "", "text-slate-600")}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
