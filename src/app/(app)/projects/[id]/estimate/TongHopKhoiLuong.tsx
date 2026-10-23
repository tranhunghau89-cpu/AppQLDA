"use client";

// Thẻ cột phải: tổng khối lượng thép tổ hợp, thép hình, xà gồ, tôn của cả dự toán, mở
// ra từng hạng mục. Cột dự toán / thực tế cùng màu với bảng (xanh / hổ phách).
import { Fragment } from "react";
import { formatQty, formatSuat } from "@/lib/utils";
import { TheThuGon } from "@/components/ui/TheThuGon";
import type { KhoiLuongVatTu } from "@/lib/tongHopKhoiLuong";

function ThucTe({ giaTri, soDong, soDongCoThuc }: { giaTri: number; soDong: number; soDongCoThuc: number }) {
  if (soDongCoThuc === 0) return <span className="text-slate-300">—</span>;
  return (
    <>
      {formatQty(giaTri)}
      {soDongCoThuc < soDong && (
        <span className="ml-0.5 text-slate-400" title={`${soDongCoThuc}/${soDong} dòng có KL thực`}>
          *
        </span>
      )}
    </>
  );
}

export function TongHopKhoiLuong({
  vatTu,
  tenHangMuc,
  area,
}: {
  vatTu: KhoiLuongVatTu[];
  /** sectionId (null = chưa phân) → tên hiện. */
  tenHangMuc: (sectionId: string | null) => string;
  area: number | null;
}) {
  if (vatTu.length === 0) return null;
  const nhieuHangMuc = new Set(vatTu.flatMap((v) => v.hangMuc.map((h) => h.sectionId))).size > 1;
  return (
    <TheThuGon khoa="tong-hop-khoi-luong" tieuDe="Tổng hợp khối lượng">
      <table className="w-full text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1 text-left font-medium">Vật tư</th>
            <th className="py-1 text-right font-medium text-blue-700">Dự toán</th>
            <th className="py-1 text-right font-medium text-amber-700">Thực tế</th>
          </tr>
        </thead>
        <tbody>
          {vatTu.map((v) => (
            <Fragment key={v.key}>
              <tr className="border-t border-slate-200">
                <td className="py-1.5 font-semibold text-slate-800">
                  {v.label}
                  {v.unit && <span className="ml-1 font-normal text-slate-400">({v.unit})</span>}
                  {area != null && area > 0 && (
                    <div className="font-normal text-slate-400" title="Khối lượng dự toán ÷ diện tích dự án">
                      {formatSuat(v.duToan / area)} {v.unit}/m²
                    </div>
                  )}
                </td>
                <td className="py-1.5 text-right align-top font-semibold tabular-nums text-slate-800">
                  {formatQty(v.duToan)}
                </td>
                <td className="py-1.5 text-right align-top font-semibold tabular-nums text-amber-800">
                  <ThucTe giaTri={v.thucTe} soDong={v.soDong} soDongCoThuc={v.soDongCoThuc} />
                </td>
              </tr>
              {nhieuHangMuc &&
                v.hangMuc.map((h) => (
                  <tr key={h.sectionId ?? "__none__"} className="text-slate-600">
                    <td className="truncate py-0.5 pl-3" title={tenHangMuc(h.sectionId)}>
                      {tenHangMuc(h.sectionId)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{formatQty(h.duToan)}</td>
                    <td className="py-0.5 text-right tabular-nums">
                      <ThucTe giaTri={h.thucTe} soDong={h.soDong} soDongCoThuc={h.soDongCoThuc} />
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        Cộng theo tên dòng; bỏ dòng công (vận chuyển, lắp dựng, lợp) và phụ kiện (bulong, ty, giằng).
      </p>
    </TheThuGon>
  );
}
