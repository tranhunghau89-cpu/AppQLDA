"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { NGUONG_SAP_DEN_HAN, soNgay } from "@/lib/ngayVN";
import { CAC_BUOC, TRANG_THAI_BUOC, type TrangThaiHien } from "@/lib/quyTrinh";
import type { BuocView } from "@/lib/quyTrinhDb";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { cn, formatDate } from "@/lib/utils";

export interface DuAnQuyTrinh {
  projectId: string;
  code: string;
  name: string;
  /** Cả chuỗi bước, theo thứ tự CAC_BUOC. */
  buoc: BuocView[];
}

type CheDo = "CUA_TOI" | "CHO_DUYET" | "QUA_HAN" | "TAT_CA";

const MO = new Set<TrangThaiHien>(["DANG_LAM", "TRA_LAI", "CHO_DUYET"]);
const THU_TU_BUOC = new Map(CAC_BUOC.map((b, i) => [b.value, i]));

const MAU_DOAN: Record<TrangThaiHien, string> = {
  DA_DUYET: "bg-green-500",
  BO_QUA: "bg-slate-100",
  DANG_LAM: "bg-blue-500",
  CHO_DUYET: "bg-amber-400",
  TRA_LAI: "bg-red-500",
  CHUA_MO: "bg-slate-200",
};

/** Số ngày trễ (dương = quá hạn); null khi không có hạn. */
const tre = (b: BuocView, nowMs: number) =>
  b.han ? soNgay(Date.parse(b.han), nowMs) : null;

function HanChip({ b, nowMs }: { b: BuocView; nowMs: number }) {
  if (!b.han) return <span className="text-xs text-slate-400">Chưa có hạn</span>;
  const t = tre(b, nowMs)!;
  const [cls, text] =
    t > 0
      ? ["bg-red-50 text-red-700 ring-red-200", `Quá hạn ${t} ngày`]
      : -t <= NGUONG_SAP_DEN_HAN
        ? ["bg-amber-50 text-amber-800 ring-amber-200", t === 0 ? "Hạn hôm nay" : `Còn ${-t} ngày`]
        : ["bg-slate-50 text-slate-600 ring-slate-200", `Hạn ${formatDate(b.han)}`];
  return (
    <span
      title={`Hạn${b.hanDatTay ? " (đặt tay)" : " theo mốc"}: ${formatDate(b.han)}`}
      className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", cls)}
    >
      {text}
    </span>
  );
}

/** Thanh tiến trình cả chuỗi bước; bước đang xét được viền đậm. */
function ThanhTienTrinh({ buoc, dangXet }: { buoc: BuocView[]; dangXet: string }) {
  const xong = buoc.filter((b) => b.trangThai === "DA_DUYET").length;
  const tinh = buoc.filter((b) => b.trangThai !== "BO_QUA").length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {buoc.map((b) => (
          <span
            key={b.buoc}
            title={`${b.ten}: ${TRANG_THAI_BUOC[b.trangThai].label}`}
            className={cn(
              "h-2 w-5 rounded-sm",
              MAU_DOAN[b.trangThai],
              b.buoc === dangXet && "ring-2 ring-slate-900 ring-offset-1",
            )}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-slate-400">
        {xong}/{tinh}
      </span>
    </div>
  );
}

export function BangViecQuyTrinh({
  duAn,
  userId,
  role,
  laAdmin,
  nowMs,
}: {
  duAn: DuAnQuyTrinh[];
  userId: string;
  role: string;
  laAdmin: boolean;
  nowMs: number;
}) {
  const tatCa = duAn.flatMap((d) =>
    d.buoc.filter((b) => MO.has(b.trangThai)).map((b) => ({ d, b })),
  );
  const loc: Record<CheDo, (b: BuocView) => boolean> = {
    CUA_TOI: (b) =>
      b.trangThai !== "CHO_DUYET" &&
      (b.phuTrachId === userId || (!b.phuTrachId && b.boPhanMacDinh === role)),
    CHO_DUYET: (b) => b.trangThai === "CHO_DUYET",
    // Chỉ tính quá hạn cho bước đã giao người phụ trách.
    QUA_HAN: (b) => b.phuTrachId != null && (tre(b, nowMs) ?? 0) > 0,
    TAT_CA: () => true,
  };
  const cacCheDo: { v: CheDo; label: string }[] = [
    { v: "CUA_TOI", label: "Tôi phụ trách" },
    ...(laAdmin ? [{ v: "CHO_DUYET" as const, label: "Chờ tôi duyệt" }] : []),
    { v: "QUA_HAN", label: "Quá hạn" },
    { v: "TAT_CA", label: "Tất cả đang mở" },
  ];
  const dem = (c: CheDo) => tatCa.filter((x) => loc[c](x.b)).length;

  const [cheDo, setCheDo] = useState<CheDo>(
    () => cacCheDo.find((c) => dem(c.v) > 0)?.v ?? "CUA_TOI",
  );
  const [chonDuAn, setChonDuAn] = useState("");

  const hien = tatCa.filter(
    (x) => loc[cheDo](x.b) && (!chonDuAn || x.d.projectId === chonDuAn),
  );

  // Gom theo bước (giai đoạn), trong mỗi bước: Trả lại trước, rồi trễ nhiều nhất.
  const theoBuoc = new Map<string, typeof hien>();
  for (const x of hien) {
    const ds = theoBuoc.get(x.b.buoc) ?? [];
    ds.push(x);
    theoBuoc.set(x.b.buoc, ds);
  }
  const nhom = [...theoBuoc.entries()]
    .sort(([a], [b]) => (THU_TU_BUOC.get(a) ?? 99) - (THU_TU_BUOC.get(b) ?? 99))
    .map(([buoc, ds]) => ({
      buoc,
      ten: ds[0].b.ten,
      ds: ds.sort(
        (x, y) =>
          Number(y.b.trangThai === "TRA_LAI") - Number(x.b.trangThai === "TRA_LAI") ||
          (tre(y.b, nowMs) ?? -Infinity) - (tre(x.b, nowMs) ?? -Infinity),
      ),
    }));

  const soCongTrinh = new Set(hien.map((x) => x.d.projectId)).size;
  const soTraLai = hien.filter((x) => x.b.trangThai === "TRA_LAI").length;
  const soChoDuyet = hien.filter((x) => x.b.trangThai === "CHO_DUYET").length;
  const soQuaHan = hien.filter((x) => (tre(x.b, nowMs) ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {cacCheDo.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setCheDo(c.v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                cheDo === c.v
                  ? "bg-slate-900 font-medium text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {c.label} <span className="tabular-nums opacity-70">{dem(c.v)}</span>
            </button>
          ))}
        </div>
        <Select className="w-64" value={chonDuAn} onChange={(e) => setChonDuAn(e.target.value)}>
          <option value="">Mọi dự án</option>
          {duAn
            .filter((d) => d.buoc.some((b) => MO.has(b.trangThai)))
            .map((d) => (
              <option key={d.projectId} value={d.projectId}>
                {d.code} — {d.name}
              </option>
            ))}
        </Select>
      </div>

      {cheDo === "CUA_TOI" && (
        <p className="-mt-2 text-xs text-slate-500">
          Bước giao cho tôi, hoặc chưa giao ai mà thuộc bộ phận của tôi.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
        <span>
          <b className="tabular-nums text-slate-900">{soCongTrinh}</b> công trình ·{" "}
          <b className="tabular-nums text-slate-900">{hien.length}</b> bước
        </span>
        {soTraLai > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <b className="tabular-nums text-red-700">{soTraLai}</b> trả lại
          </span>
        )}
        {soChoDuyet > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <b className="tabular-nums text-amber-700">{soChoDuyet}</b> chờ duyệt
          </span>
        )}
        {soQuaHan > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-300" />
            <b className="tabular-nums text-red-700">{soQuaHan}</b> quá hạn
          </span>
        )}
        <span className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          {(["DA_DUYET", "DANG_LAM", "CHO_DUYET", "TRA_LAI", "CHUA_MO"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className={cn("h-2 w-3 rounded-sm", MAU_DOAN[t])} />
              {TRANG_THAI_BUOC[t].label}
            </span>
          ))}
        </span>
      </div>

      {nhom.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-10 text-center text-slate-400">
          Không có việc nào.
        </div>
      )}

      {nhom.map((g) => (
        <section key={g.buoc} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <span className="font-semibold text-slate-900">{g.ten}</span>
            <span className="text-sm text-slate-500">· {g.ds.length} công trình</span>
          </header>
          <ul className="divide-y divide-slate-100">
            {g.ds.map(({ d, b }) => {
              const tt = TRANG_THAI_BUOC[b.trangThai];
              return (
                <li key={b.id}>
                  <Link
                    href={`/projects/${d.projectId}#quy-trinh`}
                    className={cn(
                      "grid gap-x-4 gap-y-1.5 border-l-4 px-4 py-2.5 hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_auto_auto_9rem] md:items-center",
                      b.trangThai === "TRA_LAI"
                        ? "border-l-red-500"
                        : b.trangThai === "CHO_DUYET"
                          ? "border-l-amber-400"
                          : "border-l-transparent",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs text-slate-500">{d.code}</span>
                        <span className="truncate font-medium text-slate-900">{d.name}</span>
                      </div>
                      {b.chuaDu && (
                        <p className="mt-0.5 text-xs text-slate-500">{b.chuaDu}</p>
                      )}
                    </div>
                    <ThanhTienTrinh buoc={d.buoc} dangXet={b.buoc} />
                    <div className="flex items-center gap-2">
                      <Badge tone={tt.tone}>{tt.label}</Badge>
                      <HanChip b={b} nowMs={nowMs} />
                    </div>
                    <span className="truncate text-sm text-slate-600 md:text-right">
                      {b.phuTrachTen ?? (
                        <span className="text-slate-400">
                          {ROLE_LABEL[b.boPhanMacDinh as Role] ?? b.boPhanMacDinh}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
