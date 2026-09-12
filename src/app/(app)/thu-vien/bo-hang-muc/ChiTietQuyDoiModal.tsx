"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatNumber, formatSuat, parseViNumber } from "@/lib/utils";
import { norm } from "@/lib/text";
import { quyDoiRaKg, type DongCauThanh } from "@/lib/thuVien/quyDoiKg";
import { luuChiTietQuyDoi } from "./actions";
import type { CongTacView, DongView } from "./BoHangMucList";

/** Một hàng đang soạn. Giữ chuỗi thô để người dùng gõ "0," mà ô không tự nhảy. */
interface HangSoan {
  congTacId: string;
  soLuong: string;
  khoiLuongDonVi: string;
}

const so = (s: string): number | null => (s.trim() === "" ? null : parseViNumber(s));

/**
 * Bảng cấu thành: một dòng bóc theo kg gồm mấy cỡ, mỗi cỡ mấy bộ.
 *
 * Số lượng khai cho MỘT công trình mẫu — chỉ tỉ lệ giữa các cỡ vào kết quả, nên không
 * phải khai lại cho từng nhà. Nói thẳng điều đó trên màn hình, vì "200 bộ" trông rất
 * giống một con số phải đúng với công trình đang lập.
 */
export function ChiTietQuyDoiModal({
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
  const [dangLuu, start] = useTransition();
  const [hang, setHang] = useState<HangSoan[]>(() =>
    dong.cauThanh.map((c) => ({
      congTacId: c.congTacId,
      soLuong: c.soLuong == null ? "" : formatSuat(c.soLuong),
      khoiLuongDonVi:
        congTac.find((x) => x.id === c.congTacId)?.khoiLuongDonVi == null
          ? ""
          : formatSuat(congTac.find((x) => x.id === c.congTacId)!.khoiLuongDonVi),
    }))
  );
  const [tim, setTim] = useState("");
  const [themId, setThemId] = useState("");

  const theoId = useMemo(() => new Map(congTac.map((c) => [c.id, c])), [congTac]);
  const daCo = new Set(hang.map((h) => h.congTacId));

  const conLai = useMemo(() => {
    const q = norm(tim);
    return congTac.filter((c) => {
      if (daCo.has(c.id)) return false;
      if (!q) return c.nhomChiPhi === dong.nhomChiPhi;
      return norm(`${c.ma} ${c.ten}`).includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [congTac, tim, dong.nhomChiPhi, hang]);

  const bang: DongCauThanh[] = hang.map((h) => {
    const c = theoId.get(h.congTacId);
    return {
      congTacId: h.congTacId,
      ma: c?.ma ?? "?",
      ten: c?.ten ?? "(không còn trong thư viện)",
      khoiLuongDonVi: so(h.khoiLuongDonVi),
      soLuong: so(h.soLuong),
      donGia: c?.donGia ?? null,
    };
  });
  const kq = quyDoiRaKg(bang);

  function them() {
    const id = themId || conLai[0]?.id;
    if (!id) return;
    const c = theoId.get(id);
    setHang((p) => [
      ...p,
      {
        congTacId: id,
        soLuong: "",
        khoiLuongDonVi: c?.khoiLuongDonVi == null ? "" : formatSuat(c.khoiLuongDonVi),
      },
    ]);
    setThemId("");
    setTim("");
  }

  function luu() {
    start(async () => {
      const res = await luuChiTietQuyDoi(
        dong.id,
        hang.map((h) => ({
          congTacId: h.congTacId,
          soLuong: so(h.soLuong),
          khoiLuongDonVi: so(h.khoiLuongDonVi),
        }))
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        kq.donGiaMotKg == null
          ? "Đã lưu bảng cấu thành."
          : `Đã lưu — đơn giá ${formatNumber(kq.donGiaMotKg)} đ/${dong.donVi ?? "kg"}.`
      );
      router.refresh();
      onClose();
    });
  }

  const o =
    "w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right tabular-nums hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cấu thành quy đổi — ${dong.ten}`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={luu} disabled={dangLuu}>
            {dangLuu ? "Đang lưu…" : "Lưu & đặt đơn giá"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Dòng này bóc theo <strong>{dong.donVi ?? "kg"}</strong> còn thư viện bán theo
          bộ/cái — hai đơn vị khác thứ nguyên nên không gắn thẳng một mã được. Khai các cỡ
          thực dùng và trọng lượng một bộ, hệ thống cộng ra đơn giá mỗi{" "}
          {dong.donVi ?? "kg"}.
          <br />
          <strong>Số lượng khai cho một công trình mẫu</strong> — chỉ tỉ lệ giữa các cỡ
          vào kết quả, nên khai một lần là dùng được cho mọi nhà. Trọng lượng một đơn vị
          thuộc về công tác nên sửa ở đây là sửa cho cả thư viện.
        </p>

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[40rem] text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Mã</th>
                <th className="px-2 py-1.5 text-left font-medium">Công tác</th>
                <th className="px-2 py-1.5 text-right font-medium">Giá / đơn vị</th>
                <th className="px-2 py-1.5 text-right font-medium">kg / đơn vị</th>
                <th className="px-2 py-1.5 text-right font-medium">Số lượng</th>
                <th className="px-2 py-1.5 text-right font-medium">kg</th>
                <th className="px-2 py-1.5 text-right font-medium">Tiền</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {hang.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-slate-400">
                    Chưa khai cỡ nào. Thêm ở dưới.
                  </td>
                </tr>
              )}
              {hang.map((h, i) => {
                const c = theoId.get(h.congTacId);
                const kg = so(h.khoiLuongDonVi);
                const sl = so(h.soLuong);
                const duA = kg != null && kg > 0 && sl != null && sl > 0;
                return (
                  <tr key={h.congTacId} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-mono text-slate-600">{c?.ma ?? "?"}</td>
                    <td className="px-2 py-1 text-slate-700">
                      {c?.ten ?? "(không còn trong thư viện)"}
                      <span className="ml-1 text-slate-400">({c?.donVi ?? "—"})</span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                      {c?.donGia == null ? "—" : formatNumber(c.donGia)}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        aria-label={`Trọng lượng một đơn vị — ${c?.ma ?? ""}`}
                        inputMode="decimal"
                        value={h.khoiLuongDonVi}
                        placeholder="—"
                        onChange={(e) =>
                          setHang((p) =>
                            p.map((x, j) => (j === i ? { ...x, khoiLuongDonVi: e.target.value } : x))
                          )
                        }
                        className={o}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        aria-label={`Số lượng — ${c?.ma ?? ""}`}
                        inputMode="decimal"
                        value={h.soLuong}
                        placeholder="—"
                        onChange={(e) =>
                          setHang((p) =>
                            p.map((x, j) => (j === i ? { ...x, soLuong: e.target.value } : x))
                          )
                        }
                        className={o}
                      />
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                      {duA ? formatSuat(kg! * sl!) : "—"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-600">
                      {sl != null && sl > 0 && c?.donGia != null ? formatNumber(c.donGia * sl) : "—"}
                    </td>
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        aria-label={`Xóa ${c?.ma ?? "dòng"}`}
                        onClick={() => setHang((p) => p.filter((_, j) => j !== i))}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {kq.soDongTinh > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-medium text-slate-700">
                <tr>
                  <td colSpan={4} className="px-2 py-1.5">
                    Tổng {kq.soDongTinh} cỡ
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatSuat(kq.tongSoLuong)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatSuat(kq.tongKhoiLuong)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatNumber(kq.tongTien)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={tim}
            onChange={(e) => setTim(e.target.value)}
            placeholder="Tìm mã hoặc tên…"
            className="w-48 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
          <select
            value={themId}
            onChange={(e) => setThemId(e.target.value)}
            className="min-w-[18rem] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">
              {conLai.length === 0 ? "— không còn mã nào —" : "— chọn mã để thêm —"}
            </option>
            {conLai.map((c) => (
              <option key={c.id} value={c.id}>
                {c.ma} — {c.ten} ({c.donVi ?? "—"})
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={them} disabled={conLai.length === 0}>
            <Plus className="h-4 w-4" /> Thêm cỡ
          </Button>
        </div>

        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
          {kq.donGiaMotKg == null ? (
            <span className="text-slate-500">
              Chưa đủ dữ liệu để ra đơn giá — đang giữ{" "}
              {dong.donGiaMacDinh == null ? "chưa có giá" : `${formatNumber(dong.donGiaMacDinh)} đ`}.
            </span>
          ) : (
            <span className="text-slate-700">
              Đơn giá quy đổi:{" "}
              <strong className="text-blue-700">
                {formatNumber(kq.donGiaMotKg)} đ/{dong.donVi ?? "kg"}
              </strong>
              {dong.donGiaMacDinh != null && (
                <span className="text-slate-500">
                  {" "}
                  — đang để {formatNumber(dong.donGiaMacDinh)} đ
                </span>
              )}
            </span>
          )}
        </div>

        {kq.canhBao.length > 0 && (
          <ul className="space-y-0.5 text-xs text-amber-700">
            {kq.canhBao.map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
