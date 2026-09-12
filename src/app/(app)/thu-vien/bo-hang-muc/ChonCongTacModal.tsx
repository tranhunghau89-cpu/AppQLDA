"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ESTIMATE_GROUP_MAP } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { norm } from "@/lib/text";
import { luuCongTacDong } from "./actions";
import type { CongTacView, DongView } from "./BoHangMucList";

/**
 * Chọn mã công tác thư viện cho một dòng của bộ hạng mục.
 *
 * Ba thứ bày ra để người chọn không phải đoán: ĐƠN VỊ (gắn một công tác tính theo bộ
 * cho một dòng tính theo kg là sai từ gốc), GIÁ THƯ VIỆN, và CHÊNH LỆCH so với đơn giá
 * mặc định của bộ. Chênh lệch mới là thứ nói lên "có đúng cái mình đang nghĩ không":
 * cùng tên "Tôn thẳng" nhưng 0,40mm và 0,45mm lệch nhau vài phần trăm, còn chọn nhầm
 * sang BlueScope thì lệch gấp đôi.
 *
 * Mặc định chỉ hiện công tác CÙNG NHÓM CHI PHÍ với dòng — 128 mã bày hết ra một lượt
 * thì không ai đọc. Vẫn mở được ra toàn bộ vì nhóm chi phí của dòng cũng có thể sai.
 */
export function ChonCongTacModal({
  dong,
  congTac,
  onClose,
}: {
  dong: DongView;
  congTac: CongTacView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [tim, setTim] = useState("");
  const [chiCungNhom, setChiCungNhom] = useState(true);

  const ds = useMemo(() => {
    const q = norm(tim);
    return congTac.filter((c) => {
      if (chiCungNhom && !q && c.nhomChiPhi !== dong.nhomChiPhi) return false;
      if (!q) return true;
      return norm(`${c.ma} ${c.ten}`).includes(q);
    });
  }, [congTac, tim, chiCungNhom, dong.nhomChiPhi]);

  function chon(congTacId: string | null) {
    start(async () => {
      const res = await luuCongTacDong(dong.id, congTacId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(congTacId ? "Đã gắn mã công việc." : "Đã gỡ mã công việc.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Mã công việc — ${dong.ten}`} size="xl">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Dòng này: <strong>{dong.ten}</strong> · ĐVT{" "}
          <strong>{dong.donVi ?? "—"}</strong> · nhóm{" "}
          {ESTIMATE_GROUP_MAP[dong.nhomChiPhi]?.label ?? dong.nhomChiPhi} · đơn giá mặc
          định{" "}
          <strong>
            {dong.donGiaMacDinh == null ? "—" : `${formatNumber(dong.donGiaMacDinh)} đ`}
          </strong>
          . Gắn mã xong, dự toán sẽ lấy giá từ thư viện thay cho số mặc định này.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              placeholder="Tìm theo mã hoặc tên công tác…"
              className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={chiCungNhom}
              onChange={(e) => setChiCungNhom(e.target.checked)}
            />
            Chỉ cùng nhóm chi phí
          </label>
          {dong.maCongTac && (
            <Button variant="ghost" onClick={() => chon(null)}>
              Gỡ mã {dong.maCongTac}
            </Button>
          )}
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Mã</th>
                <th className="px-2 py-1.5 text-left font-medium">Công tác</th>
                <th className="px-2 py-1.5 text-left font-medium">ĐVT</th>
                <th className="px-2 py-1.5 text-right font-medium">Giá thư viện</th>
                <th className="px-2 py-1.5 text-right font-medium">Lệch</th>
              </tr>
            </thead>
            <tbody>
              {ds.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-slate-400">
                    Không có công tác nào khớp.
                  </td>
                </tr>
              )}
              {ds.map((c) => {
                const khacDonVi = (c.donVi ?? "") !== (dong.donVi ?? "");
                const lech =
                  dong.donGiaMacDinh && dong.donGiaMacDinh > 0 && c.donGia != null
                    ? (c.donGia - dong.donGiaMacDinh) / dong.donGiaMacDinh
                    : null;
                return (
                  <tr
                    key={c.id}
                    onClick={() => chon(c.id)}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50 ${
                      c.id === dong.congTacId ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 font-mono text-slate-600">{c.ma}</td>
                    <td className="px-2 py-1.5 text-slate-700">{c.ten}</td>
                    <td
                      className={`px-2 py-1.5 ${
                        khacDonVi ? "font-medium text-amber-600" : "text-slate-500"
                      }`}
                      title={khacDonVi ? `Khác đơn vị của dòng (${dong.donVi ?? "—"})` : undefined}
                    >
                      {c.donVi ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                      {c.donGia == null ? "—" : formatNumber(c.donGia)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        lech != null && Math.abs(lech) > 0.15
                          ? "text-amber-600"
                          : "text-slate-400"
                      }`}
                    >
                      {lech == null
                        ? "—"
                        : `${lech > 0 ? "+" : ""}${(lech * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
