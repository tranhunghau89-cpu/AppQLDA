"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { norm } from "@/lib/text";
import {
  doLech,
  soSanhDuAn,
  type ChiSo,
  type DongSoSanh,
  type DuAnNhap,
  type NguonSo,
  type ThongKe,
} from "@/lib/soSanhDuAn";

type DuAn = DuAnNhap & { buildingType: string | null; status: string };

const CHI_SO: { v: ChiSo; nhan: string }[] = [
  { v: "klM2", nhan: "KL / m²" },
  { v: "tienM2", nhan: "đ / m²" },
  { v: "tyTrong", nhan: "Tỷ trọng %" },
];

const KHONG_LOAI = "__none__";

function fmt(v: number | null | undefined, cs: ChiSo): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (cs === "tyTrong") return `${(v * 100).toFixed(1)}%`;
  if (cs === "tienM2") return Math.round(v).toLocaleString("vi-VN");
  const abs = Math.abs(v);
  return v.toLocaleString("vi-VN", { maximumFractionDigits: abs >= 100 ? 0 : abs >= 1 ? 2 : 4 });
}

export function BangSoSanh({ duAn }: { duAn: DuAn[] }) {
  const loaiCo = useMemo(() => {
    const s = new Map<string, number>();
    for (const p of duAn) {
      const k = p.buildingType?.trim() || KHONG_LOAI;
      s.set(k, (s.get(k) ?? 0) + 1);
    }
    return [...s.entries()].sort((a, b) => b[1] - a[1]);
  }, [duAn]);

  const [loai, setLoai] = useState<string>("");
  const [boChon, setBoChon] = useState<Set<string>>(new Set()); // id dự án bị bỏ tick
  const [nguon, setNguon] = useState<NguonSo>("du_toan");
  const [chiSo, setChiSo] = useState<ChiSo>("tienM2");
  const [che, setChe] = useState<"hang_muc" | "nhom">("hang_muc");
  const [nguong, setNguong] = useState(25);
  const [timKiem, setTimKiem] = useState("");
  const [dong, setDong] = useState<Set<string>>(new Set()); // hạng mục đang thu gọn

  const theoLoai = useMemo(
    () => duAn.filter((p) => !loai || (p.buildingType?.trim() || KHONG_LOAI) === loai),
    [duAn, loai]
  );
  const daChon = useMemo(() => theoLoai.filter((p) => !boChon.has(p.id)), [theoLoai, boChon]);
  const kq = useMemo(() => soSanhDuAn(daChon, nguon), [daChon, nguon]);
  const thieuDienTich = daChon.filter((p) => !p.area || p.area <= 0);

  const tick = (id: string) =>
    setBoChon((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const q = norm(timKiem);
  const dongHien = useMemo(() => {
    const ds = che === "nhom" ? kq.nhom : kq.dong;
    const out: DongSoSanh[] = [];
    let hmHienTai: DongSoSanh | null = null;
    for (const d of ds) {
      if (d.cap === "hang_muc") {
        hmHienTai = d;
        if (!q || norm(d.ten).includes(q)) out.push(d);
        continue;
      }
      if (d.cap === "dau_viec" && hmHienTai && dong.has(hmHienTai.key) && !q) continue;
      if (q && !norm(d.ten).includes(q)) continue;
      out.push(d);
    }
    return out;
  }, [kq, che, q, dong]);

  const csHieuLuc: ChiSo = chiSo === "klM2" && che === "nhom" ? "tienM2" : chiSo;

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Loại công trình</span>
          <select
            value={loai}
            onChange={(e) => {
              setLoai(e.target.value);
              setBoChon(new Set());
            }}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả ({duAn.length})</option>
            {loaiCo.map(([k, n]) => (
              <option key={k} value={k}>
                {k === KHONG_LOAI ? "(Chưa ghi loại)" : k} ({n})
              </option>
            ))}
          </select>
        </label>
        <NhomNut
          nhan="Số liệu"
          giaTri={nguon}
          chon={setNguon}
          ds={[
            { v: "du_toan", nhan: "Dự toán" },
            { v: "thuc_te", nhan: "Thực tế" },
          ]}
        />
        <NhomNut
          nhan="Xem theo"
          giaTri={che}
          chon={setChe}
          ds={[
            { v: "hang_muc", nhan: "Hạng mục / đầu việc" },
            { v: "nhom", nhan: "Nhóm chi phí" },
          ]}
        />
        <NhomNut nhan="Chỉ số" giaTri={csHieuLuc} chon={setChiSo} ds={che === "nhom" ? CHI_SO.slice(1) : CHI_SO} />
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Tô màu khi lệch trung vị quá</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={nguong}
              onChange={(e) => setNguong(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm"
            />
            %
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">Tìm dòng</span>
          <input
            value={timKiem}
            onChange={(e) => setTimKiem(e.target.value)}
            placeholder="Thép tổ hợp, Tôn…"
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {/* Chọn dự án */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            Dự án tham chiếu: {daChon.length}/{theoLoai.length}
          </span>
          <span className="space-x-3 text-xs">
            <button className="text-blue-600 hover:underline" onClick={() => setBoChon(new Set())}>
              Chọn hết
            </button>
            <button
              className="text-blue-600 hover:underline"
              onClick={() => setBoChon(new Set(theoLoai.map((p) => p.id)))}
            >
              Bỏ hết
            </button>
          </span>
        </div>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {theoLoai.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                boChon.has(p.id) ? "border-slate-200 text-slate-400" : "border-blue-200 bg-blue-50 text-blue-800"
              )}
              title={p.name}
            >
              <input type="checkbox" checked={!boChon.has(p.id)} onChange={() => tick(p.id)} className="h-3 w-3" />
              {p.code}
              {!p.area || p.area <= 0 ? <span className="text-amber-600">· chưa có m²</span> : null}
            </label>
          ))}
        </div>
        {thieuDienTich.length > 0 && csHieuLuc !== "tyTrong" && (
          <p className="mt-2 text-xs text-amber-700">
            {thieuDienTich.length} dự án chưa nhập diện tích nên không có số/m² và không tính vào trung vị
            của chỉ số này — nhập diện tích ở trang dự án.
          </p>
        )}
      </div>

      {daChon.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Chọn ít nhất một dự án để so sánh.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="sticky left-0 z-10 min-w-[260px] bg-slate-50 px-3 py-2 text-left font-medium">
                  {che === "nhom" ? "Nhóm chi phí" : "Hạng mục / đầu việc"}
                </th>
                <th className="px-2 py-2 text-left font-medium">ĐV</th>
                <th className="border-l border-slate-200 bg-emerald-50 px-3 py-2 text-right font-semibold text-emerald-800">
                  Trung vị
                </th>
                <th className="px-3 py-2 text-right font-medium">TB</th>
                <th className="px-3 py-2 text-right font-medium">Min – Max</th>
                <th className="px-2 py-2 text-right font-medium">n</th>
                {kq.duAn.map((p) => (
                  <th key={p.id} className="border-l border-slate-200 px-3 py-2 text-right font-medium" title={p.name}>
                    <Link href={`/projects/${p.id}`} className="hover:text-blue-600 hover:underline">
                      {p.code}
                    </Link>
                    <div className="font-normal text-slate-400">
                      {p.area ? `${p.area.toLocaleString("vi-VN")} m²` : "— m²"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200 bg-slate-100 font-semibold">
                <td className="sticky left-0 bg-slate-100 px-3 py-2">Tổng dự toán</td>
                <td />
                <O2 v={kq.tong.tienM2.trungVi} cs="tienM2" an={csHieuLuc !== "tienM2"} className="border-l bg-emerald-50" />
                <O2 v={kq.tong.tienM2.trungBinh} cs="tienM2" an={csHieuLuc !== "tienM2"} />
                <td className="px-3 py-2 text-right text-xs font-normal text-slate-500">
                  {csHieuLuc === "tienM2" ? khoang(kq.tong.tienM2, "tienM2") : ""}
                </td>
                <td className="px-2 py-2 text-right text-xs font-normal text-slate-500">
                  {csHieuLuc === "tienM2" ? kq.tong.tienM2.n : ""}
                </td>
                {kq.duAn.map((p) => (
                  <td key={p.id} className="border-l border-slate-200 px-3 py-2 text-right">
                    {csHieuLuc === "tienM2" ? fmt(p.tongM2, "tienM2") : csHieuLuc === "tyTrong" ? "100%" : ""}
                    <div className="text-xs font-normal text-slate-500">{(p.tong / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tr</div>
                  </td>
                ))}
              </tr>
              {dongHien.map((d) => {
                const laCha = d.cap !== "dau_viec";
                const tk = d.thongKe[csHieuLuc];
                const thuGon = dong.has(d.key);
                return (
                  <Fragment key={d.key}>
                    <tr className={cn("border-t border-slate-100", d.cap === "hang_muc" && "bg-slate-50 font-medium")}>
                      <td
                        className={cn(
                          "sticky left-0 px-3 py-1.5",
                          d.cap === "hang_muc" ? "bg-slate-50" : "bg-white",
                          d.cap === "dau_viec" && "pl-8"
                        )}
                      >
                        {d.cap === "hang_muc" ? (
                          <button
                            className="flex items-center gap-1 text-left"
                            onClick={() =>
                              setDong((s) => {
                                const n = new Set(s);
                                if (n.has(d.key)) n.delete(d.key);
                                else n.add(d.key);
                                return n;
                              })
                            }
                          >
                            {thuGon ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {d.ten}
                          </button>
                        ) : (
                          d.ten
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-500">
                        {laCha ? "" : d.donVi}
                        {d.donViLech && (
                          <span className="ml-1 text-amber-600" title="Đơn vị khác nhau giữa các dự án — KL không so được">
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="border-l border-slate-200 bg-emerald-50/60 px-3 py-1.5 text-right font-semibold text-emerald-900">
                        {fmt(tk.trungVi, csHieuLuc)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">{fmt(tk.trungBinh, csHieuLuc)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-slate-500">{khoang(tk, csHieuLuc)}</td>
                      <td className="px-2 py-1.5 text-right text-xs text-slate-500">{tk.n || ""}</td>
                      {kq.duAn.map((p) => {
                        const o = d.theoDuAn[p.id];
                        const v = o?.[csHieuLuc];
                        const lech = doLech(v, tk);
                        const vuot = lech != null && Math.abs(lech) * 100 > nguong;
                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "border-l border-slate-100 px-3 py-1.5 text-right tabular-nums",
                              vuot && lech! > 0 && "bg-red-50 text-red-700",
                              vuot && lech! < 0 && "bg-sky-50 text-sky-700"
                            )}
                            title={
                              o
                                ? `KL ${o.kl.toLocaleString("vi-VN")} · ${o.tien.toLocaleString("vi-VN")} đ` +
                                  (lech != null ? ` · lệch ${(lech * 100).toFixed(0)}% so với trung vị` : "")
                                : "Dự án không có dòng này"
                            }
                          >
                            {o ? fmt(v, csHieuLuc) : <span className="text-slate-300">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        <span className="mr-3 inline-block rounded bg-red-50 px-1.5 text-red-700">cao hơn trung vị</span>
        <span className="mr-3 inline-block rounded bg-sky-50 px-1.5 text-sky-700">thấp hơn trung vị</span>
        KL/m² chỉ có ở đầu việc (hạng mục gồm nhiều đơn vị). Trung vị chỉ tính trên các dự án có dòng đó
        (cột n); di chuột vào ô để xem KL và thành tiền gốc.
      </p>
    </div>
  );
}

function khoang(tk: ThongKe, cs: ChiSo) {
  if (tk.n < 2) return "";
  return `${fmt(tk.min, cs)} – ${fmt(tk.max, cs)}`;
}

function O2({ v, cs, an, className }: { v: number | null; cs: ChiSo; an: boolean; className?: string }) {
  return <td className={cn("border-slate-200 px-3 py-2 text-right", className)}>{an ? "" : fmt(v, cs)}</td>;
}

function NhomNut<T extends string>({
  nhan,
  giaTri,
  chon,
  ds,
}: {
  nhan: string;
  giaTri: T;
  chon: (v: T) => void;
  ds: { v: T; nhan: string }[];
}) {
  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-500">{nhan}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {ds.map((o) => (
          <button
            key={o.v}
            onClick={() => chon(o.v)}
            className={cn(
              "px-3 py-1.5 text-sm",
              o.v === giaTri ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {o.nhan}
          </button>
        ))}
      </div>
    </div>
  );
}
