// Bảng tổng hợp giá trị dự án qua 5 giai đoạn + lợi nhuận dự kiến / thực tế.
import type { ReactNode } from "react";
import { formatVND } from "@/lib/utils";
import { formatPercent } from "@/lib/profit";
import { loiNhuanGiaiDoan, type GiaTriGiaiDoan } from "@/lib/giaTriGiaiDoan";

function Dong({
  nhan,
  giaTri,
  ghiChu,
  o,
}: {
  nhan: string;
  giaTri: number | null;
  ghiChu?: string;
  /** Thay phần số mặc định (vd. ô sửa giá bán). */
  o?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-slate-500">
        {nhan}
        {ghiChu && <span className="ml-1 text-xs text-slate-400">{ghiChu}</span>}
      </dt>
      <dd className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">
        {o ?? (giaTri == null ? "—" : formatVND(giaTri))}
      </dd>
    </div>
  );
}

function LoiNhuan({ nhan, giaTri, ghiChu }: { nhan: string; giaTri: number | null; ghiChu?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-slate-500">
        {nhan}
        {ghiChu && <span className="ml-1 text-xs text-amber-600">{ghiChu}</span>}
      </dt>
      <dd
        className={`shrink-0 whitespace-nowrap font-bold tabular-nums ${
          giaTri == null ? "text-slate-400" : giaTri >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        {giaTri == null ? "—" : formatVND(giaTri)}
      </dd>
    </div>
  );
}

export function BangGiaiDoan({
  g,
  oHopDong,
  chiPhiM2,
}: {
  g: GiaTriGiaiDoan;
  oHopDong?: ReactNode;
  chiPhiM2?: number | null;
}) {
  const ln = loiNhuanGiaiDoan(g);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Giá trị theo giai đoạn</h3>
      <p className="mb-3 text-xs text-slate-400">Tất cả chưa VAT</p>
      <dl className="space-y-2 text-sm">
        <Dong nhan="1. Báo giá" giaTri={g.baoGia} />
        <Dong nhan="2. Dự toán (chi phí)" giaTri={g.duToan} />
        <Dong
          nhan="3. Mua hàng (chi phí thực)"
          giaTri={g.muaHang}
          ghiChu={g.soDong > 0 ? `${g.soDongCoGiaThuc}/${g.soDong} dòng có giá thực` : undefined}
        />
        <Dong nhan="4. Hợp đồng" giaTri={g.hopDong} o={oHopDong} />
        <Dong nhan="5. Quyết toán" giaTri={g.quyetToan} />
        <div className="my-2 border-t border-slate-100" />
        <LoiNhuan nhan="Lợi nhuận dự kiến" giaTri={ln.duKien} ghiChu="HĐ − dự toán" />
        <LoiNhuan
          nhan="Lợi nhuận thực tế"
          giaTri={ln.thucTe}
          ghiChu={ln.tamTinh ? "tạm tính theo HĐ" : "QT − chi phí thực"}
        />
        <div className="flex justify-between">
          <dt className="text-slate-500">Biên thực tế</dt>
          <dd className="font-medium text-slate-700">{formatPercent(ln.bienThucTe)}</dd>
        </div>
        {chiPhiM2 !== undefined && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Chi phí / m²</dt>
            <dd className="font-medium text-slate-700">
              {chiPhiM2 != null ? formatVND(chiPhiM2) : "—"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
