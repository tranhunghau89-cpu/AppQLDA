"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/ui/form";
import { QC_GIAI_DOAN, QC_GIAI_DOAN_MAP } from "@/lib/constants";
import { NGUONG_SAP_DEN_HAN, soNgay } from "@/lib/ngayVN";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { cn, formatDate } from "@/lib/utils";

export interface ViecQcRow {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  giaiDoan: string;
  noiDung: string;
  boPhan: string;
  ketQua: string;
  ghiChu: string | null;
  han: string | null;
  mocXong: boolean;
}

interface NhomGiaiDoan {
  giaiDoan: string;
  han: string | null;
  mocXong: boolean;
  muc: ViecQcRow[];
  khongDat: number;
}
interface NhomDuAn {
  projectId: string;
  code: string;
  name: string;
  giaiDoan: NhomGiaiDoan[];
  khongDat: number;
  chua: number;
  hanSomNhat: number;
}

const THU_TU_GD = new Map(QC_GIAI_DOAN.map((o, i) => [o.value, i]));

/** Dự án → giai đoạn (theo thứ tự mốc) → mục (Không đạt trước). */
function gomNhom(rows: ViecQcRow[]): NhomDuAn[] {
  const duAn = new Map<string, NhomDuAn>();
  for (const r of rows) {
    let da = duAn.get(r.projectId);
    if (!da) {
      da = {
        projectId: r.projectId,
        code: r.projectCode,
        name: r.projectName,
        giaiDoan: [],
        khongDat: 0,
        chua: 0,
        hanSomNhat: Infinity,
      };
      duAn.set(r.projectId, da);
    }
    let gd = da.giaiDoan.find((g) => g.giaiDoan === r.giaiDoan);
    if (!gd) {
      gd = {
        giaiDoan: r.giaiDoan,
        han: r.han,
        mocXong: r.mocXong,
        muc: [],
        khongDat: 0,
      };
      da.giaiDoan.push(gd);
    }
    gd.muc.push(r);
    if (r.ketQua === "KHONG_DAT") {
      gd.khongDat++;
      da.khongDat++;
    } else da.chua++;
    if (r.han && !r.mocXong)
      da.hanSomNhat = Math.min(da.hanSomNhat, Date.parse(r.han));
  }
  const ds = [...duAn.values()];
  for (const da of ds) {
    da.giaiDoan.sort(
      (a, b) =>
        (THU_TU_GD.get(a.giaiDoan) ?? 99) - (THU_TU_GD.get(b.giaiDoan) ?? 99),
    );
    for (const gd of da.giaiDoan)
      gd.muc.sort(
        (a, b) =>
          Number(b.ketQua === "KHONG_DAT") - Number(a.ketQua === "KHONG_DAT"),
      );
  }
  return ds.sort(
    (a, b) =>
      Number(b.khongDat > 0) - Number(a.khongDat > 0) ||
      a.hanSomNhat - b.hanSomNhat ||
      a.code.localeCompare(b.code),
  );
}

/** Mức gấp của giai đoạn: lỗi > quá hạn/sắp đến hạn > bình thường. */
function mucGap(gd: NhomGiaiDoan, nowMs: number): "do" | "vang" | "thuong" {
  if (gd.khongDat > 0) return "do";
  if (
    !gd.mocXong &&
    gd.han &&
    soNgay(nowMs, Date.parse(gd.han)) <= NGUONG_SAP_DEN_HAN
  )
    return "vang";
  return "thuong";
}

const CHIP_GAP = {
  do: "bg-red-50 text-red-700 ring-red-200",
  vang: "bg-amber-50 text-amber-800 ring-amber-200",
  thuong: "bg-slate-50 text-slate-600 ring-slate-200",
};

function HanChip({
  han,
  mocXong,
  nowMs,
}: {
  han: string | null;
  mocXong: boolean;
  nowMs: number;
}) {
  if (mocXong)
    return <span className="text-xs text-slate-400">Mốc đã xong</span>;
  if (!han) return <span className="text-xs text-slate-400">Chưa có hạn</span>;
  const con = soNgay(nowMs, Date.parse(han));
  const [cls, text] =
    con < 0
      ? ["bg-red-50 text-red-700 ring-red-200", `Quá hạn ${-con} ngày`]
      : con <= NGUONG_SAP_DEN_HAN
        ? [
            "bg-amber-50 text-amber-800 ring-amber-200",
            con === 0 ? "Hạn hôm nay" : `Còn ${con} ngày`,
          ]
        : [
            "bg-slate-50 text-slate-600 ring-slate-200",
            `Hạn ${formatDate(han)}`,
          ];
  return (
    <span
      title={`Hạn mốc: ${formatDate(han)}`}
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        cls,
      )}
    >
      {text}
    </span>
  );
}

function SoDem({
  n,
  tone,
  nhan,
}: {
  n: number;
  tone: "red" | "slate";
  nhan: string;
}) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "red"
          ? "bg-red-100 text-red-700"
          : "bg-slate-100 text-slate-600",
      )}
    >
      <span className="tabular-nums">{n}</span> {nhan}
    </span>
  );
}

export function BangViecQc({
  rows,
  laAdmin,
  nowMs,
}: {
  rows: ViecQcRow[];
  laAdmin: boolean;
  nowMs: number;
}) {
  const [duAn, setDuAn] = useState("");
  const [giaiDoan, setGiaiDoan] = useState("");
  const [ketQua, setKetQua] = useState("");
  const [boPhan, setBoPhan] = useState("");
  // Mặc định chỉ mở công trình gấp nhất; null = chưa ai bấm.
  const [mo, setMo] = useState<Set<string> | null>(null);

  const duAnList = [
    ...new Map(
      rows.map((r) => [r.projectId, `${r.projectCode} — ${r.projectName}`]),
    ).entries(),
  ];
  const hien = rows.filter(
    (r) =>
      (!duAn || r.projectId === duAn) &&
      (!giaiDoan || r.giaiDoan === giaiDoan) &&
      (!ketQua || r.ketQua === ketQua) &&
      (!boPhan || r.boPhan === boPhan),
  );
  const nhom = gomNhom(hien);
  const tongKhongDat = hien.filter((r) => r.ketQua === "KHONG_DAT").length;
  const tongQuaHan = hien.filter(
    (r) => r.han && !r.mocXong && soNgay(nowMs, Date.parse(r.han)) < 0,
  ).length;
  const dangMo =
    mo ??
    new Set(
      duAn || nhom.length === 1
        ? nhom.map((n) => n.projectId)
        : nhom.slice(0, 1).map((n) => n.projectId),
    );
  const moHet = nhom.length > 0 && nhom.every((n) => dangMo.has(n.projectId));

  const lat = (id: string) => {
    const t = new Set(dangMo);
    if (t.has(id)) t.delete(id);
    else t.add(id);
    setMo(t);
  };

  return (
    <div className="space-y-4">
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
          {QC_GIAI_DOAN.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          className="w-56"
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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-slate-600">
          <b className="tabular-nums text-slate-900">{nhom.length}</b> công
          trình · <b className="tabular-nums text-slate-900">{hien.length}</b>{" "}
          mục
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <b className="tabular-nums text-red-700">{tongKhongDat}</b> không đạt
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <b className="tabular-nums text-slate-900">
            {hien.length - tongKhongDat}
          </b>{" "}
          chưa kiểm
        </span>
        {tongQuaHan > 0 && (
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <b className="tabular-nums text-amber-700">{tongQuaHan}</b> quá hạn
            mốc
          </span>
        )}
        {nhom.length > 1 && (
          <button
            type="button"
            className="ml-auto text-sm text-blue-600 hover:underline"
            onClick={() =>
              setMo(moHet ? new Set() : new Set(nhom.map((n) => n.projectId)))
            }
          >
            {moHet ? "Thu gọn tất cả" : "Mở tất cả"}
          </button>
        )}
      </div>

      {nhom.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-10 text-center text-slate-400">
          Không có việc QC nào
        </div>
      )}

      {nhom.map((da) => {
        const daMo = dangMo.has(da.projectId);
        const href = `/projects/${da.projectId}#qc`;
        return (
          <section
            key={da.projectId}
            className={cn(
              "overflow-hidden rounded-xl border bg-white",
              da.khongDat > 0 ? "border-red-200" : "border-slate-200",
            )}
          >
            <header
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3",
                da.khongDat > 0
                  ? "border-l-4 border-l-red-500"
                  : "border-l-4 border-l-slate-300",
              )}
            >
              <button
                type="button"
                onClick={() => lat(da.projectId)}
                aria-expanded={daMo}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    !daMo && "-rotate-90",
                  )}
                />
                <span className="font-mono text-xs text-slate-500">
                  {da.code}
                </span>
                <span className="truncate font-semibold text-slate-900">
                  {da.name}
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <SoDem n={da.khongDat} tone="red" nhan="không đạt" />
                <SoDem n={da.chua} tone="slate" nhan="chưa kiểm" />
                <Link
                  href={href}
                  className="ml-2 text-xs text-blue-600 hover:underline"
                >
                  Mở QC →
                </Link>
              </div>
            </header>

            {!daMo && (
              <button
                type="button"
                onClick={() => lat(da.projectId)}
                className="flex w-full flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5 pl-10 text-left"
              >
                {da.giaiDoan.map((gd) => (
                  <span
                    key={gd.giaiDoan}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs ring-1 ring-inset",
                      CHIP_GAP[mucGap(gd, nowMs)],
                    )}
                  >
                    {QC_GIAI_DOAN_MAP[gd.giaiDoan]?.label ?? gd.giaiDoan}{" "}
                    <b className="tabular-nums">{gd.muc.length}</b>
                  </span>
                ))}
              </button>
            )}

            {daMo && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {da.giaiDoan.map((gd) => (
                  <div key={gd.giaiDoan} className="sm:flex">
                    <div className="flex items-center gap-2 bg-slate-50/70 px-4 py-2 sm:w-48 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1 sm:py-3">
                      <span className="text-sm font-medium text-slate-800">
                        {QC_GIAI_DOAN_MAP[gd.giaiDoan]?.label ?? gd.giaiDoan}
                      </span>
                      <HanChip
                        han={gd.han}
                        mocXong={gd.mocXong}
                        nowMs={nowMs}
                      />
                      <span className="ml-auto text-xs text-slate-400 sm:ml-0">
                        {gd.muc.length} mục
                      </span>
                    </div>
                    <ul className="min-w-0 flex-1 divide-y divide-slate-50">
                      {gd.muc.map((r) => {
                        const loi = r.ketQua === "KHONG_DAT";
                        return (
                          <li key={r.id}>
                            <Link
                              href={href}
                              className="flex items-start gap-3 px-4 py-2 hover:bg-slate-50"
                            >
                              <span
                                title={loi ? "Không đạt" : "Chưa kiểm"}
                                className={cn(
                                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                  loi
                                    ? "bg-red-500"
                                    : "border border-slate-300",
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className={cn(
                                    "text-sm",
                                    loi
                                      ? "font-medium text-red-800"
                                      : "text-slate-700",
                                  )}
                                >
                                  {r.noiDung}
                                </span>
                                {r.ghiChu && (
                                  <span className="mt-0.5 block text-xs text-slate-500">
                                    {r.ghiChu}
                                  </span>
                                )}
                              </span>
                              <span className="hidden shrink-0 text-xs text-slate-400 md:inline">
                                {ROLE_LABEL[r.boPhan as Role] ?? r.boPhan}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
