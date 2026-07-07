"use client";

import { useMemo, useState } from "react";
import { STEEL_SECTIONS, STEEL_GROUPS, STEEL_GROUP_LABEL, type SteelSection } from "@/lib/steel-data";

function fmt(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

export function SteelLookup() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("ALL");
  const [sel, setSel] = useState<SteelSection | null>(null);
  const [len, setLen] = useState("");
  const [qty, setQty] = useState("1");

  const list = useMemo(() => {
    const norm = q.toLowerCase().replace(/[\s*×]/g, "x");
    return STEEL_SECTIONS.filter(
      (s) =>
        (group === "ALL" || s.group === group) &&
        (!norm || s.name.toLowerCase().replace(/[\s*×]/g, "x").includes(norm))
    ).slice(0, 120);
  }, [q, group]);

  const L = Number(len.replace(",", ".")) || 0;
  const n = Number(qty) || 0;
  const kg = sel ? sel.wPerM * L * n : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm nhanh: I300, V50x5, Ø16, 40x80x1.4..."
            className="w-72 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
          >
            <option value="ALL">Tất cả nhóm</option>
            {STEEL_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
          <span className="self-center text-xs text-slate-400">{list.length} mã (hiển thị tối đa 120)</span>
        </div>
        <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nhóm</th>
                <th className="px-3 py-2">Quy cách</th>
                <th className="px-3 py-2 text-right">kg/m</th>
                <th className="px-3 py-2 text-right">Tiết diện (cm²)</th>
                <th className="px-3 py-2 text-right">kg/cây</th>
                <th className="px-3 py-2 text-right">Cây (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {list.map((s) => (
                <tr
                  key={s.group + s.name}
                  onClick={() => setSel(s)}
                  className={`cursor-pointer hover:bg-blue-50 ${sel?.name === s.name && sel.group === s.group ? "bg-blue-50" : ""}`}
                >
                  <td className="px-3 py-1.5 text-xs text-slate-400">{STEEL_GROUP_LABEL[s.group]}</td>
                  <td className="px-3 py-1.5 font-mono font-medium text-slate-800">{s.name}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-blue-600">{fmt(s.wPerM)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">{fmt(s.area)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">{fmt(s.wPerBar)}{s.group === "TAM" && s.wPerBar != null ? "/m²" : ""}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{fmt(s.barLen, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Máy tính nhanh</h3>
          {sel ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <span className="font-mono font-semibold text-blue-700">{sel.name}</span>
                <span className="ml-2 text-slate-500">{fmt(sel.wPerM)} kg/m</span>
              </div>
              <label className="block">
                <span className="text-xs text-slate-500">Chiều dài mỗi thanh (m)</span>
                <input value={len} onChange={(e) => setLen(e.target.value)} inputMode="decimal"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder={sel.barLen ? `cây tiêu chuẩn ${sel.barLen} m` : "ví dụ 8.5"} />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Số lượng (thanh)</span>
                <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <div className="rounded-lg bg-slate-50 px-3 py-3 text-center">
                <div className="text-xs text-slate-500">Khối lượng</div>
                <div className="text-2xl font-bold text-blue-600">{fmt(kg)} kg</div>
                {kg > 0 && <div className="text-xs text-slate-400">= {fmt(kg / 1000, 3)} tấn</div>}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Bấm vào một mã thép bên trái để tính nhanh khối lượng theo chiều dài × số lượng.</p>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Nguồn: bảng tra Toàn Thắng / Hữu Liên Á Châu (409 mã). Thép tròn tính cây 11,7m; V/ống/hộp cây 6m; H/I/U theo cột "Cây".
        </p>
      </div>
    </div>
  );
}
