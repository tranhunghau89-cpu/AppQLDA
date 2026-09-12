"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { formatNumber, formatQty, formatSuat, parseViNumber } from "@/lib/utils";
import { luuSuatDong } from "./actions";
import { ChonCongTacModal } from "./ChonCongTacModal";
import { ChiTietQuyDoiModal } from "./ChiTietQuyDoiModal";
import type { CongTacView, DongView } from "./BoHangMucList";

/**
 * Thư viện khối lượng của một phần: mỗi dòng công tác một SUẤT — khối lượng trên một
 * đơn vị diện tích của chính phần đó.
 *
 * Áp bộ vào dự toán rồi nhập diện tích là khối lượng tự điền theo suất này. Dòng không
 * khai suất thì dùng khối lượng tuyệt đối (cột bên cạnh), cho những việc không tỉ lệ
 * với diện tích như "vận chuyển: 2 chuyến".
 */
export function BangSuat({
  dong,
  tenPhan,
  congTac,
  canEdit,
}: {
  dong: DongView[];
  tenPhan: string;
  congTac: CongTacView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  // Chỉ giữ ô người dùng ĐANG gõ; còn lại luôn đọc từ máy chủ.
  const [nhap, setNhap] = useState<Record<string, string>>({});
  const [dongChonMa, setDongChonMa] = useState<DongView | null>(null);
  const [dongQuyDoi, setDongQuyDoi] = useState<DongView | null>(null);

  if (dong.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-400">Phần này chưa có dòng công tác nào.</p>;
  }

  function luu(d: DongView, thoNhap: string) {
    const cu = d.suatKhoiLuong == null ? "" : formatSuat(d.suatKhoiLuong);
    if (thoNhap.trim() === cu) return;

    const v = thoNhap.trim() === "" ? null : parseViNumber(thoNhap);
    if (thoNhap.trim() !== "" && v == null) {
      toast.error(`Suất của "${d.ten}" không phải là số.`);
      setNhap((p) => ({ ...p, [d.id]: cu }));
      return;
    }
    start(async () => {
      const res = await luuSuatDong(d.id, v);
      if (!res.ok) {
        toast.error(res.error);
        setNhap((p) => ({ ...p, [d.id]: cu }));
      } else {
        router.refresh();
      }
    });
  }

  const soCoSuat = dong.filter((d) => d.suatKhoiLuong != null).length;
  const soCoMa = dong.filter((d) => d.maCongTac).length;

  return (
    <div className="bg-slate-50 px-4 py-3">
      <p className="mb-2 text-xs text-slate-500">
        Suất khối lượng của <strong>{tenPhan}</strong> — khối lượng trên 1 m² diện tích
        của chính phần này. {soCoSuat}/{dong.length} dòng đã khai suất, {soCoMa}/{dong.length}
        dòng đã gắn mã công việc.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Mã</th>
              <th className="px-2 py-1 text-left font-medium">Công tác</th>
              <th className="px-2 py-1 text-left font-medium">ĐVT</th>
              <th className="px-2 py-1 text-right font-medium">Đơn giá</th>
              <th className="px-2 py-1 text-left font-medium">Cấu thành</th>
              <th className="px-2 py-1 text-right font-medium">Suất / m²</th>
              <th className="px-2 py-1 text-right font-medium">KL tuyệt đối</th>
            </tr>
          </thead>
          <tbody>
            {dong.map((d) => (
              <tr key={d.id} className="border-t border-slate-200/70">
                <td className="py-1 font-mono">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setDongChonMa(d)}
                      title="Chọn mã công việc trong thư viện"
                      className={`rounded px-1.5 py-0.5 hover:bg-white hover:ring-1 hover:ring-slate-300 ${
                        d.maCongTac ? "text-slate-600" : "text-amber-600"
                      }`}
                    >
                      {d.maCongTac ?? "gắn mã"}
                    </button>
                  ) : (
                    <span className="text-slate-400">{d.maCongTac ?? "—"}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-slate-700">{d.ten}</td>
                <td className="px-2 py-1 text-slate-500">{d.donVi ?? "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                  {d.donGiaMacDinh == null ? "—" : formatNumber(d.donGiaMacDinh)}
                </td>
                <td className="px-2 py-1">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setDongQuyDoi(d)}
                      title="Khai các cỡ hợp thành để quy đổi đơn vị"
                      className={`rounded px-1.5 py-0.5 hover:bg-white hover:ring-1 hover:ring-slate-300 ${
                        d.cauThanh.length > 0 ? "text-slate-600" : "text-slate-400"
                      }`}
                    >
                      {d.cauThanh.length > 0 ? `${d.cauThanh.length} cỡ` : "quy đổi"}
                    </button>
                  ) : (
                    <span className="text-slate-400">
                      {d.cauThanh.length > 0 ? `${d.cauThanh.length} cỡ` : "—"}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right">
                  {canEdit ? (
                    <input
                      aria-label={`Suất khối lượng — ${d.ten}`}
                      inputMode="decimal"
                      value={nhap[d.id] ?? (d.suatKhoiLuong == null ? "" : formatSuat(d.suatKhoiLuong))}
                      onChange={(e) => setNhap((p) => ({ ...p, [d.id]: e.target.value }))}
                      onBlur={(e) => luu(d, e.target.value)}
                      placeholder="—"
                      className="w-24 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right tabular-nums hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  ) : (
                    <span className="tabular-nums text-slate-700">
                      {d.suatKhoiLuong == null ? "—" : formatSuat(d.suatKhoiLuong)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-400">
                  {d.khoiLuongMacDinh == null ? "—" : formatQty(d.khoiLuongMacDinh)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dongQuyDoi && (
        <ChiTietQuyDoiModal
          dong={dongQuyDoi}
          congTac={congTac}
          onClose={() => setDongQuyDoi(null)}
        />
      )}

      {dongChonMa && (
        <ChonCongTacModal
          dong={dongChonMa}
          congTac={congTac}
          onClose={() => setDongChonMa(null)}
        />
      )}
    </div>
  );
}
