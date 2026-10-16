"use client";

// Dashboard cột phải của trang dự toán thi công: giá trị theo giai đoạn và chi phí theo
// nhóm, vẽ bằng thanh CSS (không cần thư viện biểu đồ cho vài thanh ngang).
//
// Hai màu mang danh tính cố định, khớp với bảng: xanh = dự toán, hổ phách = thực tế.
// Hổ phách tương phản thấp trên nền trắng nên MỌI thanh đều có nhãn số bên cạnh.
import { useState } from "react";
import { formatVND } from "@/lib/utils";
import type { GiaTriGiaiDoan } from "@/lib/giaTriGiaiDoan";

const MAU_DU_TOAN = "#2563eb";
const MAU_THUC_TE = "#f59e0b";

export interface NhomSoSanh {
  code: string;
  label: string;
  duToan: number;
  thucTe: number;
  /** Có dòng chưa có giá thực → thực tế của nhóm đang tạm lấy theo dự toán. */
  tamTinh: boolean;
}

/** Số gọn cho nhãn thanh: 2,4 tỷ · 520 tr · 31 tr. */
function gon(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return v.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

/** Phần trăm cho nhãn thanh: 42,5%. */
const pt = (v: number) => `${(v * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

type CheDo = "TIEN" | "PT";

/** Công tắc Giá trị / %. */
function ChonCheDo({ cheDo, doi }: { cheDo: CheDo; doi: (c: CheDo) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
      {(
        [
          ["TIEN", "Giá trị"],
          ["PT", "%"],
        ] as const
      ).map(([k, nhan]) => (
        <button
          key={k}
          type="button"
          onClick={() => doi(k)}
          aria-pressed={cheDo === k}
          className={`rounded px-2 py-0.5 font-medium ${
            cheDo === k ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {nhan}
        </button>
      ))}
    </div>
  );
}

function Thanh({ giaTri, max, mau, title }: { giaTri: number; max: number; mau: string; title: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (giaTri / max) * 100)) : 0;
  return (
    <div className="h-2 flex-1 rounded-r bg-slate-100" title={title}>
      {w > 0 && <div className="h-2 rounded-r" style={{ width: `${w}%`, background: mau }} />}
    </div>
  );
}

function ChenhLech({ duToan, thucTe }: { duToan: number; thucTe: number }) {
  const d = thucTe - duToan;
  if (Math.round(d) === 0) return <span className="text-slate-400">khớp dự toán</span>;
  const pct = duToan ? ` (${d > 0 ? "+" : ""}${((d / duToan) * 100).toFixed(1)}%)` : "";
  return (
    <span className={d > 0 ? "text-red-600" : "text-green-600"}>
      {d > 0 ? "▲ vượt " : "▼ tiết kiệm "}
      {formatVND(Math.abs(d))}
      {pct}
    </span>
  );
}

export function DashboardDuToan({ g, nhom }: { g: GiaTriGiaiDoan; nhom: NhomSoSanh[] }) {
  const giaiDoan: { nhan: string; giaTri: number | null; mau: string }[] = [
    { nhan: "Báo giá", giaTri: g.baoGia, mau: "#64748b" },
    { nhan: "Dự toán", giaTri: g.duToan, mau: MAU_DU_TOAN },
    { nhan: "Mua hàng", giaTri: g.muaHang, mau: MAU_THUC_TE },
    { nhan: "Hợp đồng", giaTri: g.hopDong, mau: "#64748b" },
    { nhan: "Quyết toán", giaTri: g.quyetToan, mau: "#64748b" },
  ];
  const [cheDo, setCheDo] = useState<CheDo>("TIEN");
  const laPT = cheDo === "PT";

  // Chế độ %: giai đoạn so với hợp đồng (giá bán); chưa có HĐ thì so với dự toán.
  const goc = g.hopDong ?? g.duToan;
  const tenGoc = g.hopDong != null ? "hợp đồng" : "dự toán";
  const maxGd = Math.max(0, ...giaiDoan.map((x) => x.giaTri ?? 0));
  const nhanGd = (v: number) => (laPT ? (goc ? pt(v / goc) : "—") : gon(v));

  // Chế độ %: tỉ trọng của nhóm trong tổng dự toán / tổng thực tế.
  const tongDT = nhom.reduce((t, n) => t + n.duToan, 0);
  const tongTT = nhom.reduce((t, n) => t + n.thucTe, 0);
  const dtNhom = (n: NhomSoSanh) => (laPT ? (tongDT ? n.duToan / tongDT : 0) : n.duToan);
  const ttNhom = (n: NhomSoSanh) => (laPT ? (tongTT ? n.thucTe / tongTT : 0) : n.thucTe);
  const maxNhom = laPT ? 1 : Math.max(0, ...nhom.flatMap((n) => [n.duToan, n.thucTe]));
  const nhanNhom = (v: number) => (laPT ? pt(v) : gon(v));
  const daMua = g.duToan > 0 ? g.muaHang / g.duToan : null;

  return (
    <div className="space-y-4">
      {/* Dự toán ↔ thực tế: con số chính */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Dự toán và thực tế</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: MAU_DU_TOAN }} /> Dự toán
            </div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{gon(g.duToan)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: MAU_THUC_TE }} /> Thực tế
            </div>
            <div className="text-lg font-semibold tabular-nums text-slate-900">{gon(g.muaHang)}</div>
          </div>
        </div>
        <div className="mt-2 text-sm font-medium">
          <ChenhLech duToan={g.duToan} thucTe={g.muaHang} />
        </div>
        {daMua != null && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Thực tế / dự toán</span>
              <span className="tabular-nums">{(daMua * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded"
                style={{
                  width: `${Math.min(100, daMua * 100)}%`,
                  background: daMua > 1 ? "#dc2626" : MAU_THUC_TE,
                }}
              />
            </div>
            {g.soDongCoGiaThuc < g.soDong && (
              <p className="mt-1 text-xs text-slate-400">
                {g.soDongCoGiaThuc}/{g.soDong} dòng có giá thực — dòng còn lại tạm theo dự toán
              </p>
            )}
          </div>
        )}
      </div>

      {/* Năm giai đoạn trên cùng một thang */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Biểu đồ giai đoạn</h3>
          <ChonCheDo cheDo={cheDo} doi={setCheDo} />
        </div>
        <p className="mb-3 text-xs text-slate-400">
          {laPT ? `% so với ${tenGoc} · chưa VAT` : "Chưa VAT · cùng một thang"}
        </p>
        <dl className="space-y-2 text-sm">
          {giaiDoan.map((x) => (
            <div key={x.nhan} className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-slate-500">{x.nhan}</dt>
              {x.giaTri == null ? (
                <dd className="flex-1 text-xs text-slate-300">chưa có</dd>
              ) : (
                <>
                  <Thanh giaTri={x.giaTri} max={maxGd} mau={x.mau} title={`${x.nhan}: ${formatVND(x.giaTri)}`} />
                  <dd className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-700">{nhanGd(x.giaTri)}</dd>
                </>
              )}
            </div>
          ))}
        </dl>
      </div>

      {/* Theo nhóm: dự toán và thực tế cạnh nhau */}
      {nhom.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Theo nhóm</h3>
            <ChonCheDo cheDo={cheDo} doi={setCheDo} />
          </div>
          {laPT ? (
            <CoCauNhom nhom={nhom} tongDT={tongDT} tongTT={tongTT} />
          ) : (
          <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Chưa VAT</span>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: MAU_DU_TOAN }} /> Dự toán
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: MAU_THUC_TE }} /> Thực tế
              </span>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {nhom.map((n) => (
              <li key={n.code}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-slate-700">{n.label}</span>
                  <span className="text-xs">
                    <ChenhLech duToan={n.duToan} thucTe={n.thucTe} />
                    {n.tamTinh && <span className="ml-1 text-slate-400" title="Có dòng chưa có giá thực">*</span>}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Thanh giaTri={dtNhom(n)} max={maxNhom} mau={MAU_DU_TOAN} title={`Dự toán: ${formatVND(n.duToan)}`} />
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-600">{nhanNhom(dtNhom(n))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Thanh giaTri={ttNhom(n)} max={maxNhom} mau={MAU_THUC_TE} title={`Thực tế: ${formatVND(n.thucTe)}`} />
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-600">{nhanNhom(ttNhom(n))}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Chế độ %: hai vòng tròn cơ cấu (mỗi vòng = 100%) ----------

// Bảng màu phân loại đã kiểm định (thư viện dataviz), gán THEO THỨ TỰ cố định, không
// quay vòng: nhóm thứ 8 trở đi gộp thành "Khác" màu xám.
const MAU_NHOM = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
const MAU_KHAC = "#94a3b8";

interface Lat {
  code: string;
  label: string;
  mau: string;
  duToan: number;
  thucTe: number;
}

function gopLat(nhom: NhomSoSanh[]): Lat[] {
  const ds: Lat[] = nhom.slice(0, MAU_NHOM.length).map((n, i) => ({
    code: n.code,
    label: n.label,
    mau: MAU_NHOM[i],
    duToan: n.duToan,
    thucTe: n.thucTe,
  }));
  const du = nhom.slice(MAU_NHOM.length);
  if (du.length > 0) {
    ds.push({
      code: "__khac__",
      label: `Khác (${du.length} nhóm)`,
      mau: MAU_KHAC,
      duToan: du.reduce((t, n) => t + n.duToan, 0),
      thucTe: du.reduce((t, n) => t + n.thucTe, 0),
    });
  }
  return ds;
}

/** Vòng tròn 100%: mỗi lát một nhóm, khe 2px màu nền giữa các lát. */
function VongTron({ tieuDe, tong, lat }: { tieuDe: string; tong: number; lat: { mau: string; giaTri: number; nhan: string }[] }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let daQua = 0;
  const coLat = lat.filter((l) => l.giaTri > 0);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" role="img" aria-label={tieuDe}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {tong > 0 &&
          coLat.map((l) => {
            const dai = (l.giaTri / tong) * C;
            const khe = coLat.length > 1 ? Math.min(1.5, dai / 2) : 0;
            const el = (
              <circle
                key={l.nhan}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={l.mau}
                strokeWidth="14"
                strokeDasharray={`${Math.max(0, dai - khe)} ${C}`}
                strokeDashoffset={-daQua}
              >
                <title>{`${l.nhan}: ${pt(l.giaTri / tong)} · ${formatVND(l.giaTri)}`}</title>
              </circle>
            );
            daQua += dai;
            return el;
          })}
      </svg>
      <figcaption className="mt-1 text-center text-xs">
        <div className="font-medium text-slate-700">{tieuDe}</div>
        <div className="tabular-nums text-slate-400">{gon(tong)}</div>
      </figcaption>
    </figure>
  );
}

function CoCauNhom({ nhom, tongDT, tongTT }: { nhom: NhomSoSanh[]; tongDT: number; tongTT: number }) {
  const lat = gopLat(nhom);
  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">Cơ cấu chi phí — mỗi vòng là 100%</p>
      <div className="grid grid-cols-2 gap-2">
        <VongTron
          tieuDe="Dự toán"
          tong={tongDT}
          lat={lat.map((l) => ({ mau: l.mau, giaTri: l.duToan, nhan: l.label }))}
        />
        <VongTron
          tieuDe="Thực tế"
          tong={tongTT}
          lat={lat.map((l) => ({ mau: l.mau, giaTri: l.thucTe, nhan: l.label }))}
        />
      </div>
      <table className="mt-3 w-full text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 text-left font-medium">Nhóm</th>
            <th className="py-1 text-right font-medium">Dự toán</th>
            <th className="py-1 text-right font-medium">Thực tế</th>
          </tr>
        </thead>
        <tbody>
          {lat.map((l) => (
            <tr key={l.code} className="border-t border-slate-100">
              <td className="py-1 text-slate-700">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: l.mau }} />
                {l.label}
              </td>
              <td className="py-1 text-right tabular-nums text-slate-600">{tongDT ? pt(l.duToan / tongDT) : "—"}</td>
              <td className="py-1 text-right tabular-nums text-slate-600">{tongTT ? pt(l.thucTe / tongTT) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
