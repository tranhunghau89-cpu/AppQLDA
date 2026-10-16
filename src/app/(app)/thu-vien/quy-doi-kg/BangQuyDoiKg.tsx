"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OSoSua } from "@/components/ui/OSoSua";
import { useToast } from "@/components/ui/toast";
import { norm } from "@/lib/text";
import { formatVND } from "@/lib/utils";
import { apKgHangLoat, suaKgMotDonVi } from "./actions";

export interface DongQuyDoi {
  id: string;
  ma: string;
  ten: string;
  quyCach: string | null;
  donVi: string | null;
  /** Đơn giá hiện hành mỗi bộ/cái (giá chung). */
  donGia: number | null;
  /** Kg một đơn vị đã khai — null = chưa khai. */
  kg: number | null;
  goiY: { kg: number; cauTao: string } | null;
}

const kgVN = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export function BangQuyDoiKg({ dong, canEdit }: { dong: DongQuyDoi[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [dangChay, start] = useTransition();
  const [tim, setTim] = useState("");
  const [chiTrong, setChiTrong] = useState(false);

  const loc = useMemo(() => {
    const q = norm(tim);
    return dong.filter(
      (d) =>
        (!chiTrong || d.kg == null) && (!q || norm(`${d.ma} ${d.ten} ${d.quyCach ?? ""}`).includes(q))
    );
  }, [dong, tim, chiTrong]);

  const coTheAp = dong.filter((d) => d.kg == null && d.goiY);
  const soDaKhai = dong.filter((d) => d.kg != null).length;

  function apGoiY() {
    start(async () => {
      const res = await apKgHangLoat(coTheAp.map((d) => ({ congTacId: d.id, kg: d.goiY!.kg })));
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Đã ghi kg ước tính cho ${res.soGhi ?? 0} mã.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={tim}
          onChange={(e) => setTim(e.target.value)}
          placeholder="Tìm mã, tên, quy cách…"
          className="h-9 w-64 rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={chiTrong} onChange={(e) => setChiTrong(e.target.checked)} />
          Chỉ mã chưa khai
        </label>
        <span className="text-sm text-slate-500">
          {soDaKhai}/{dong.length} mã đã khai kg
        </span>
        {canEdit && coTheAp.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={apGoiY} disabled={dangChay}>
            <Wand2 className="mr-1.5 h-4 w-4" />
            {dangChay ? "Đang ghi…" : `Ghi số ước tính cho ${coTheAp.length} mã còn trống`}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Mã</th>
              <th className="px-3 py-2 text-left font-medium">Tên / quy cách</th>
              <th className="px-3 py-2 text-left font-medium">ĐVT</th>
              <th className="px-3 py-2 text-right font-medium">Đơn giá / đv</th>
              <th className="px-3 py-2 text-right font-medium">Kg / đv</th>
              <th className="px-3 py-2 text-right font-medium">Đơn giá / kg</th>
              <th className="px-3 py-2 text-left font-medium">Gợi ý theo quy cách</th>
            </tr>
          </thead>
          <tbody>
            {loc.map((d) => {
              const kgDung = d.kg ?? d.goiY?.kg ?? null;
              return (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{d.ma}</td>
                  <td className="px-3 py-1.5 text-slate-800">
                    {d.ten}
                    {d.quyCach ? <div className="text-xs text-slate-400">{d.quyCach}</div> : null}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{d.donVi}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.donGia == null ? "—" : formatVND(d.donGia)}</td>
                  <td className="w-32 px-3 py-1.5 text-right">
                    {canEdit ? (
                      <OSoSua
                        nhan={`Kg một ${d.donVi ?? "đơn vị"} — ${d.ten}`}
                        giaTri={d.kg}
                        dinhDang={kgVN}
                        khoa={false}
                        luu={(tho) => suaKgMotDonVi(d.id, tho)}
                      />
                    ) : (
                      kgVN(d.kg)
                    )}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${d.kg == null ? "text-slate-400" : "text-slate-700"}`}
                    title={d.kg == null && kgDung != null ? "Tính theo số ước tính" : undefined}
                  >
                    {d.donGia != null && kgDung ? `${d.kg == null ? "≈ " : ""}${formatVND(Math.round(d.donGia / kgDung))}` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">
                    {d.goiY ? (
                      <>
                        <span className="tabular-nums text-slate-700">≈ {kgVN(d.goiY.kg)} kg</span> · {d.goiY.cauTao}
                        {d.kg != null && Math.abs(d.kg - d.goiY.kg) / d.goiY.kg > 0.3 && (
                          <span className="ml-1 text-amber-700" title="Số đã khai lệch hơn 30% so với ước tính — kiểm lại">
                            ⚠ lệch nhiều
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300">không đọc ra quy cách</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {loc.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                  Không có mã nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
