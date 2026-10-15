"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { MILESTONE_TYPE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { trangThaiMoc, type TrangThaiMoc } from "@/lib/projectHealth";
import { danhGiaThoiHan, lapKeHoach, MOC_NGOAI_THOI_HAN, type MocDauVao } from "@/lib/tienDo";
import { saveTienDo } from "../actions";
import { useToast } from "@/components/ui/toast";

export interface MilestoneValue {
  planDate: string | null;
  actualDate: string | null;
  done: boolean;
  note: string | null;
  durationDays: number | null;
  overlapDays: number | null;
}

export interface HopDongCanCu {
  id: string;
  ten: string;
  daKy: boolean;
  signDate: string | null;
  effectiveDate: string | null;
  durationDays: number | null;
}

// Tô màu theo giá trị ĐÃ LƯU, không theo ô đang gõ.
const MAU_MOC: Record<TrangThaiMoc, string> = {
  XONG: "border-l-green-500",
  TRE: "border-l-red-500 bg-red-50",
  SAP_DEN: "border-l-amber-500 bg-amber-50",
  DUNG_HAN: "border-l-slate-300",
  CHUA_CO: "border-l-slate-200",
};

interface Dong {
  type: string;
  durationDays: string;
  overlapDays: string;
  planDate: string; // chỉ dùng khi không có số ngày
  actualDate: string;
  done: boolean;
}

function toInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}
function toNum(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}
function toDate(v: string): Date | null {
  return v ? new Date(`${v}T00:00:00Z`) : null;
}

function CanhBao({ vuot, nhan }: { vuot: number | null; nhan: string }) {
  if (vuot == null) return null;
  if (vuot > 0)
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
        <AlertTriangle className="h-4 w-4" /> {nhan} vượt thời hạn HĐ {vuot} ngày
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-sm text-green-700">
      <CheckCircle2 className="h-4 w-4" /> {nhan} trong thời hạn HĐ
      {vuot < 0 ? ` (còn dư ${-vuot} ngày)` : " (đúng hạn)"}
    </p>
  );
}

export function Milestones({
  projectId,
  milestones,
  canEdit,
  canEditContract,
  hopDong,
  nowMs,
}: {
  projectId: string;
  milestones: Record<string, MilestoneValue>;
  canEdit: boolean;
  canEditContract: boolean;
  hopDong: HopDongCanCu | null;
  nowMs: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const suaHD = canEdit && canEditContract && !!hopDong;

  const [hieuLuc, setHieuLuc] = useState(toInput(hopDong?.effectiveDate ?? null));
  const [thoiHan, setThoiHan] = useState(hopDong?.durationDays?.toString() ?? "");
  const [dongs, setDongs] = useState<Dong[]>(() =>
    MILESTONE_TYPE.map((m) => {
      const v = milestones[m.value];
      return {
        type: m.value,
        durationDays: v?.durationDays?.toString() ?? "",
        overlapDays: v?.overlapDays?.toString() ?? "",
        planDate: toInput(v?.planDate ?? null),
        actualDate: toInput(v?.actualDate ?? null),
        done: v?.done ?? false,
      };
    })
  );

  const sua = (i: number, p: Partial<Dong>) =>
    setDongs((ds) => ds.map((d, j) => (j === i ? { ...d, ...p } : d)));

  const { keHoach, danhGia } = useMemo(() => {
    const hl = toDate(hieuLuc);
    const dauVao: MocDauVao[] = dongs.map((d) => ({
      type: d.type,
      durationDays: toNum(d.durationDays),
      overlapDays: toNum(d.overlapDays),
      planDate: toDate(d.planDate),
      actualDate: toDate(d.actualDate),
      done: d.done,
    }));
    const kh = lapKeHoach(hl, dauVao);
    return { keHoach: kh, danhGia: danhGiaThoiHan(hl, toNum(thoiHan), dauVao, kh, nowMs) };
  }, [dongs, hieuLuc, thoiHan, nowMs]);

  const tongSoNgay = dongs
    .filter((d) => !MOC_NGOAI_THOI_HAN.has(d.type))
    .reduce((s, d) => s + (toNum(d.durationDays) ?? 0) - (toNum(d.overlapDays) ?? 0), 0);

  function save() {
    start(async () => {
      const res = await saveTienDo(projectId, {
        contractId: suaHD ? hopDong!.id : null,
        effectiveDate: hieuLuc,
        contractDays: thoiHan,
        rows: dongs.map((d) => ({
          type: d.type,
          durationDays: d.durationDays,
          overlapDays: d.overlapDays,
          planDate: d.planDate,
          actualDate: d.actualDate,
          done: d.done,
        })),
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Đã lưu tiến độ.");
        router.refresh();
      }
    });
  }

  const coSoNgay = dongs.some((d) => d.durationDays.trim() !== "");

  return (
    <div className="space-y-3">
      {/* Căn cứ hợp đồng */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        {hopDong ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="text-slate-600">
              Căn cứ: <span className="font-medium text-slate-800">{hopDong.ten}</span>
              {!hopDong.daKy && <span className="ml-1 text-amber-700">(chưa ký)</span>}
              {hopDong.signDate && <span className="ml-1">· ký {formatDate(hopDong.signDate)}</span>}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Ngày HĐ có hiệu lực</span>
              {suaHD ? (
                <Input className="h-9 w-40" type="date" value={hieuLuc} onChange={(e) => setHieuLuc(e.target.value)} />
              ) : (
                <span className="font-medium">{hieuLuc ? formatDate(hieuLuc) : "—"}</span>
              )}
            </label>
            {suaHD && !hieuLuc && hopDong.signDate && (
              <Button size="sm" variant="outline" onClick={() => setHieuLuc(toInput(hopDong.signDate))}>
                Lấy ngày ký
              </Button>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Thời hạn thực hiện (ngày)</span>
              {suaHD ? (
                <Input
                  className="h-9 w-28"
                  type="number"
                  min={0}
                  value={thoiHan}
                  onChange={(e) => setThoiHan(e.target.value)}
                />
              ) : (
                <span className="font-medium">{thoiHan || "—"}</span>
              )}
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Hạn hoàn thành theo HĐ</span>
              <span className="font-medium">{danhGia.hanHD ? formatDate(danhGia.hanHD) : "—"}</span>
            </div>
          </div>
        ) : (
          <p className="text-slate-500">
            Dự án chưa có hợp đồng — tạo HĐ và nhập ngày hiệu lực, thời hạn ở mục Hợp đồng để tự tính kế hoạch.
          </p>
        )}
        <div className="mt-2 space-y-1">
          <CanhBao vuot={danhGia.vuotKH} nhan="Kế hoạch" />
          <CanhBao
            vuot={danhGia.vuotTT}
            nhan={danhGia.xongHet ? "Thực tế" : "Thực tế (tính đến hôm nay, chưa xong)"}
          />
          {coSoNgay && !hieuLuc && (
            <p className="text-sm text-amber-700">
              Chưa có ngày hiệu lực — các mốc có số ngày chưa tính được, đang giữ ngày kế hoạch cũ.
            </p>
          )}
          {coSoNgay && (
            <p className="text-xs text-slate-500">
              Tổng số ngày các giai đoạn (trừ gối đầu, không tính HS quyết toán): {tongSoNgay} ngày
              {thoiHan ? ` / thời hạn HĐ ${thoiHan} ngày` : ""}.
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase text-slate-400">
              <th className="py-1 pl-3">Mốc</th>
              <th className="py-1">Số ngày</th>
              <th className="py-1" title="Bắt đầu sớm N ngày trước khi mốc trước kết thúc">Gối đầu</th>
              <th className="py-1">Bắt đầu KH</th>
              <th className="py-1">Kết thúc KH</th>
              <th className="py-1">Thực tế</th>
              <th className="py-1">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MILESTONE_TYPE.map((m, i) => {
              const d = dongs[i];
              const kh = keHoach[i];
              const daLuu = milestones[m.value];
              const mau =
                MAU_MOC[
                  trangThaiMoc(
                    { planDate: daLuu?.planDate ? new Date(daLuu.planDate) : null, done: daLuu?.done ?? false },
                    nowMs
                  )
                ];
              const treSoVoiKH =
                kh.ketThuc && d.actualDate && toDate(d.actualDate)! > kh.ketThuc
                  ? Math.round((toDate(d.actualDate)!.getTime() - kh.ketThuc.getTime()) / 86400000)
                  : 0;
              return (
                <tr key={m.value} className={`border-l-4 ${mau}`}>
                  <td className="py-2 pl-2 font-medium text-slate-600">
                    {m.label}
                    {MOC_NGOAI_THOI_HAN.has(m.value) && (
                      <span className="block text-xs font-normal text-slate-400">ngoài thời hạn HĐ</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {canEdit ? (
                      <Input
                        className="h-9 w-20"
                        type="number"
                        min={0}
                        value={d.durationDays}
                        onChange={(e) => sua(i, { durationDays: e.target.value })}
                      />
                    ) : (
                      d.durationDays || "—"
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {canEdit ? (
                      <Input
                        className="h-9 w-16"
                        type="number"
                        min={0}
                        value={d.overlapDays}
                        disabled={d.durationDays.trim() === ""}
                        onChange={(e) => sua(i, { overlapDays: e.target.value })}
                      />
                    ) : (
                      d.overlapDays || "—"
                    )}
                  </td>
                  <td className="py-2 pr-2 text-slate-600">{kh.batDau ? formatDate(kh.batDau) : "—"}</td>
                  <td className="py-2 pr-2">
                    {kh.tuTinh || !canEdit ? (
                      <span className={kh.tuTinh ? "font-medium" : ""}>
                        {kh.ketThuc ? formatDate(kh.ketThuc) : "—"}
                      </span>
                    ) : (
                      <Input
                        className="h-9 w-40"
                        type="date"
                        title="Nhập tay — điền Số ngày để tự tính"
                        value={d.planDate}
                        onChange={(e) => sua(i, { planDate: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {canEdit ? (
                      <Input
                        className="h-9 w-40"
                        type="date"
                        value={d.actualDate}
                        onChange={(e) => sua(i, { actualDate: e.target.value })}
                      />
                    ) : (
                      formatDate(d.actualDate || null)
                    )}
                    {treSoVoiKH > 0 && (
                      <span className="block text-xs text-red-600">trễ {treSoVoiKH} ngày so với KH</span>
                    )}
                  </td>
                  <td className="py-2">
                    {canEdit ? (
                      <label className="flex items-center gap-2 text-slate-600">
                        <input
                          type="checkbox"
                          checked={d.done}
                          onChange={(e) => sua(i, { done: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Xong
                      </label>
                    ) : d.done ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Check className="h-4 w-4" /> Xong
                      </span>
                    ) : (
                      <span className="text-slate-400">Chưa</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu tiến độ"}
          </Button>
        </div>
      )}
    </div>
  );
}
