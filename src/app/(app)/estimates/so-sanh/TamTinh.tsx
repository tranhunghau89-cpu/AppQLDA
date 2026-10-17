"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { tamTinh, type KetQuaSoSanh } from "@/lib/soSanhDuAn";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { doTamTinhVaoDuAn } from "./actions";
import type { DuAnDich } from "./BangSoSanh";

const so = (v: number | null, le = 0) =>
  v == null ? "—" : v.toLocaleString("vi-VN", { maximumFractionDigits: le });

/**
 * Tạm tính dự toán dự án mới từ trung vị các dự án đang chọn ở bảng trên, và đổ thẳng
 * thành một hạng mục trong dự toán thi công của dự án đích.
 */
export function TamTinh({ kq, canEdit, duAnDich }: { kq: KetQuaSoSanh; canEdit: boolean; duAnDich: DuAnDich[] }) {
  const [m2, setM2] = useState("");
  const [coMat, setCoMat] = useState(50);
  const [duAnId, setDuAnId] = useState("");
  const [tenHm, setTenHm] = useState("Tạm tính theo chỉ số chuẩn");
  const [bo, setBo] = useState<Set<string>>(new Set());
  const [tb, setTb] = useState<{ ok: boolean; text: string } | null>(null);
  const [dangGui, batDau] = useTransition();

  const dt = Number(m2.replace(/\./g, "").replace(",", "."));
  const dong = useMemo(() => (dt > 0 ? tamTinh(kq, dt, coMat / 100) : []), [kq, dt, coMat]);
  const dungDong = dong.filter((d) => !bo.has(d.khoaDauViec));
  const tong = dungDong.reduce((s, d) => s + d.tien, 0);
  const tongTheoTv = kq.tong.tienM2.trungVi != null && dt > 0 ? kq.tong.tienM2.trungVi * dt : null;

  const chonDuAn = (id: string) => {
    setDuAnId(id);
    const p = duAnDich.find((x) => x.id === id);
    if (p?.area && !m2) setM2(String(p.area).replace(".", ","));
  };
  const duAn = duAnDich.find((p) => p.id === duAnId);

  return (
    <section className="space-y-3 rounded-lg border border-emerald-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Tạm tính dự án mới</h2>
        <p className="text-sm text-slate-500">
          KL = KL/m² trung vị × diện tích; đơn giá = đơn giá trung vị của {kq.duAn.length} dự án đang chọn ở trên.
          Chỉ lấy đầu việc có mặt ở đủ tỷ lệ dự án — bỏ tick dòng không áp dụng.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        {canEdit && (
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Dự án đích (lấy diện tích)</span>
            <select value={duAnId} onChange={(e) => chonDuAn(e.target.value)} className="w-64 rounded-md border border-slate-300 px-2 py-1.5">
              <option value="">— Chỉ tính thử —</option>
              {duAnDich.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                  {p.soDong ? ` (đã có ${p.soDong} dòng)` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Diện tích (m²)</span>
          <input
            value={m2}
            onChange={(e) => setM2(e.target.value)}
            inputMode="decimal"
            placeholder="vd 2.000"
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Đầu việc có ở ít nhất</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={coMat}
              onChange={(e) => setCoMat(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-right"
            />
            % dự án
          </span>
        </label>
      </div>

      {dt > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 text-left font-medium">Đầu việc</th>
                  <th className="px-3 py-2 text-left font-medium">Nhóm</th>
                  <th className="px-2 py-2 text-left font-medium">ĐV</th>
                  <th className="px-3 py-2 text-right font-medium">KL</th>
                  <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
                  <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
                  <th className="px-2 py-2 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((d) => {
                  const tat = bo.has(d.khoaDauViec);
                  return (
                    <tr key={d.khoaDauViec} className={tat ? "border-t border-slate-100 text-slate-400 line-through" : "border-t border-slate-100"}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={!tat}
                          onChange={() =>
                            setBo((s) => {
                              const n = new Set(s);
                              if (n.has(d.khoaDauViec)) n.delete(d.khoaDauViec);
                              else n.add(d.khoaDauViec);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">{d.ten}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-500">{ESTIMATE_GROUP_MAP[d.groupCode]?.label ?? d.groupCode}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-500">{d.donVi}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{so(d.kl, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{so(d.donGia)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{so(d.tien)}</td>
                      <td className="px-2 py-1.5 text-right text-xs text-slate-500">{d.n}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 font-semibold">
                  <td colSpan={6} className="px-3 py-2 text-right">
                    Tổng {dungDong.length} dòng · {so(tong / dt)} đ/m²
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{so(tong)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {tongTheoTv != null && (
            <p className="text-xs text-slate-500">
              Đối chiếu: tổng dự toán trung vị {so(kq.tong.tienM2.trungVi)} đ/m² × {so(dt, 2)} m² = <b>{so(tongTheoTv)}</b> đ.
              Tổng các dòng trên thường lệch con số này vì trung vị của từng dòng không cộng lại thành trung vị của tổng.
            </p>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 text-sm">
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-500">Tên hạng mục sẽ tạo</span>
                <input value={tenHm} onChange={(e) => setTenHm(e.target.value)} className="w-72 rounded-md border border-slate-300 px-2 py-1.5" />
              </label>
              <button
                disabled={!duAn || dungDong.length === 0 || dangGui}
                onClick={() => {
                  if (!duAn) return;
                  if (!confirm(`Thêm hạng mục "${tenHm}" gồm ${dungDong.length} dòng vào dự toán thi công của ${duAn.code}? Dòng đang có giữ nguyên.`)) return;
                  batDau(async () => {
                    setTb(null);
                    const r = await doTamTinhVaoDuAn(duAn.id, tenHm, dungDong);
                    setTb(r.ok ? { ok: true, text: `Đã thêm ${r.soDong} dòng vào ${duAn.code}.` } : { ok: false, text: r.error });
                  });
                }}
                className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {dangGui ? "Đang thêm…" : duAn ? `Đổ vào dự toán ${duAn.code}` : "Chọn dự án đích để đổ vào dự toán"}
              </button>
              {tb && (
                <span className={tb.ok ? "text-emerald-700" : "text-red-700"}>
                  {tb.text}{" "}
                  {tb.ok && duAn && (
                    <Link href={`/projects/${duAn.id}/estimate`} className="underline">
                      Mở dự toán
                    </Link>
                  )}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
