"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { tinhBieuThuc } from "@/lib/bieuThuc";
import { tongMucCon, type LoaiMucCon } from "@/lib/khoiLuong/mucCon";
import { formatQty, formatVND } from "@/lib/utils";
import { traKgMotDonVi, type MauKg } from "@/lib/thuVien/trongLuongBulong";
import { boGhiDeThucTe, luuMucCon } from "./actions";
import type { EstimateRow, MucConRow } from "./EstimateEditor";

/** Một dòng đang sửa: ô số giữ CHUỖI THÔ để gõ được "1.234,5" hay "=12*30". */
interface DongSua {
  khoa: number;
  ten: string;
  donVi: string;
  khoiLuong: string;
  donGia: string;
  /** Kg một đơn vị (bộ/cái → kg). Trống = lấy gợi ý từ bảng quy đổi. */
  kgMotDonVi: string;
  ghiChu: string;
}

const soVN = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
let dem = 0;
const tuMucCon = (m: MucConRow): DongSua => ({
  khoa: ++dem,
  ten: m.ten,
  donVi: m.donVi ?? "",
  khoiLuong: soVN(m.khoiLuong),
  donGia: soVN(m.donGia),
  kgMotDonVi: soVN(m.kgMotDonVi),
  ghiChu: m.ghiChu ?? "",
});
const dongTrong = (donVi: string | null): DongSua => ({
  khoa: ++dem,
  ten: "",
  donVi: donVi ?? "",
  khoiLuong: "",
  donGia: "",
  kgMotDonVi: "",
  ghiChu: "",
});
const chuanDv = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const doc = (tho: string) => (tho.trim() === "" ? null : tinhBieuThuc(tho));

const TEN: Record<LoaiMucCon, string> = { DU_TOAN: "Dự toán", THUC_TE: "Thực tế (mua hàng)" };

/**
 * Mục con của một đầu việc: "Bulong liên kết" = M12×30, M16×50… mỗi mã một giá.
 *
 * Hai phía SỬA RIÊNG và được có danh sách mã khác nhau — mua thực tế hay đổi mã so với
 * dự toán. Đối chiếu ở cấp đầu việc. Lưu một phía thay toàn bộ danh sách phía đó.
 */
export function MucConModal({
  projectId,
  dong,
  thuVienKg,
  onClose,
}: {
  projectId: string;
  dong: EstimateRow;
  thuVienKg: MauKg[];
  onClose: () => void;
}) {
  // Đầu việc tính kg → mục con tính bộ/cái cần kg một đơn vị để cộng được khối lượng.
  const laKg = chuanDv(dong.unit) === "kg";
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [loai, setLoai] = useState<LoaiMucCon>("DU_TOAN");
  const [ds, setDs] = useState<Record<LoaiMucCon, DongSua[]>>(() => ({
    DU_TOAN: dong.mucConDuToan.map(tuMucCon),
    THUC_TE: dong.mucConThucTe.map(tuMucCon),
  }));
  const [loi, setLoi] = useState<string | null>(null);

  const dang = ds[loai];
  const sua = (khoa: number, truong: keyof Omit<DongSua, "khoa">, v: string) =>
    setDs((c) => ({ ...c, [loai]: c[loai].map((d) => (d.khoa === khoa ? { ...d, [truong]: v } : d)) }));
  const them = () => setDs((c) => ({ ...c, [loai]: [...c[loai], dongTrong(dong.unit)] }));
  const xoa = (khoa: number) => setDs((c) => ({ ...c, [loai]: c[loai].filter((d) => d.khoa !== khoa) }));

  // Ô số gõ sai thì báo ngay tại dòng, không gửi đi.
  const daDoc = dang.map((d) => {
    const canQuyDoi = laKg && d.donVi.trim() !== "" && chuanDv(d.donVi) !== "kg";
    const goiY = canQuyDoi ? traKgMotDonVi(d.ten, thuVienKg) : null;
    const kgGo = doc(d.kgMotDonVi);
    return {
      ...d,
      kl: doc(d.khoiLuong),
      dg: doc(d.donGia),
      klSai: d.khoiLuong.trim() !== "" && doc(d.khoiLuong) == null,
      dgSai: d.donGia.trim() !== "" && doc(d.donGia) == null,
      kgSai: d.kgMotDonVi.trim() !== "" && (kgGo == null || kgGo <= 0),
      canQuyDoi,
      goiY,
      // Số người gõ thắng gợi ý; không cần quy đổi thì bỏ.
      kg: canQuyDoi ? (kgGo ?? goiY?.kg ?? null) : null,
    };
  });
  // Phía thực tế còn cộng các món đơn hàng đã gắn (chỉ đọc — sửa ở màn đơn hàng).
  const donHang = loai === "THUC_TE" ? dong.donHang : [];
  const tong = tongMucCon(
    [
      ...daDoc.map((d) => ({ ten: d.ten, donVi: d.donVi || null, khoiLuong: d.kl, donGia: d.dg, kgMotDonVi: d.kg })),
      ...donHang,
    ],
    dong.unit
  );

  function luu() {
    setLoi(null);
    if (daDoc.some((d) => d.klSai || d.dgSai || d.kgSai)) return setLoi("Có ô số không đọc được — sửa ô viền đỏ.");
    const conTen = daDoc.filter((d) => d.ten.trim() || d.kl != null || d.dg != null);
    if (conTen.some((d) => !d.ten.trim())) return setLoi("Mỗi mục con phải có tên / mã.");
    start(async () => {
      const res = await luuMucCon(
        projectId,
        dong.id,
        loai,
        conTen.map((d) => ({
          ten: d.ten.trim(),
          donVi: d.donVi.trim() || null,
          khoiLuong: d.kl,
          donGia: d.dg,
          kgMotDonVi: d.kg,
          ghiChu: d.ghiChu.trim() || null,
        }))
      );
      if (!res.ok) return setLoi(res.error);
      toast.success(`Đã lưu ${conTen.length} mục con ${TEN[loai].toLowerCase()}.`);
      router.refresh();
      onClose();
    });
  }

  function boGhiDe() {
    start(async () => {
      const res = await boGhiDeThucTe(projectId, dong.id);
      if (!res.ok) return setLoi(res.error);
      toast.success("Thực tế lại cộng theo mục con.");
      router.refresh();
      onClose();
    });
  }

  const o = "w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none";
  const oSai = "border-red-400 bg-red-50";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mục con — ${dong.name}`}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <Button onClick={luu} disabled={pending}>
            {pending ? "Đang lưu…" : `Lưu ${TEN[loai].toLowerCase()}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-slate-200">
          {(Object.keys(TEN) as LoaiMucCon[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLoai(l);
                setLoi(null);
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
                l === loai ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {TEN[l]} <span className="text-xs text-slate-400">({ds[l].length + (l === "THUC_TE" ? dong.donHang.length : 0)})</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">
          {loai === "DU_TOAN"
            ? "Thành tiền dự toán của đầu việc = tổng các mục con; khối lượng cộng lại khi cùng đơn vị với đầu việc (đầu việc tính kg thì bộ/cái được quy ra kg theo cột kg/đv). Ô KL và đơn giá trên bảng sẽ khoá."
            : "Thực tế được có mã khác dự toán. Thành tiền thực của đầu việc = tổng các mục con — trừ khi đã gõ tay ô thực tế trên bảng (ghi đè)."}{" "}
          Ô số nhận công thức, ví dụ <span className="font-mono">=120*0,42</span>.
        </p>

        {loai === "THUC_TE" && dong.thucTeGhiDe && dong.mucConThucTe.length + dong.donHang.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>Đầu việc đang GHI ĐÈ thực tế bằng số gõ tay — mục con không được cộng lên.</span>
            <Button size="sm" variant="outline" onClick={boGhiDe} disabled={pending}>
              Bỏ ghi đè
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-1 py-1 text-left font-medium">Mã / quy cách</th>
                <th className="w-20 px-1 py-1 text-left font-medium">ĐVT</th>
                <th className="w-28 px-1 py-1 text-right font-medium">KL</th>
                {laKg && (
                  <th
                    className="w-24 px-1 py-1 text-right font-medium"
                    title="Kg một bộ/cái để quy ra kg của đầu việc. Trống = lấy theo bảng quy đổi trong Thư viện, không có thì ước tính theo quy cách."
                  >
                    kg/đv
                  </th>
                )}
                <th className="w-32 px-1 py-1 text-right font-medium">Đơn giá</th>
                <th className="w-36 px-1 py-1 text-right font-medium">Thành tiền</th>
                <th className="px-1 py-1 text-left font-medium">Ghi chú</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {daDoc.map((d) => (
                <tr key={d.khoa}>
                  <td className="px-1 py-0.5">
                    <input className={o} value={d.ten} placeholder="M16×50" onChange={(e) => sua(d.khoa, "ten", e.target.value)} />
                  </td>
                  <td className="px-1 py-0.5">
                    <input className={o} value={d.donVi} onChange={(e) => sua(d.khoa, "donVi", e.target.value)} />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      className={`${o} text-right tabular-nums ${d.klSai ? oSai : ""}`}
                      value={d.khoiLuong}
                      inputMode="decimal"
                      onChange={(e) => sua(d.khoa, "khoiLuong", e.target.value)}
                    />
                  </td>
                  {laKg && (
                    <td className="px-1 py-0.5">
                      {d.canQuyDoi ? (
                        <input
                          className={`${o} text-right tabular-nums ${d.kgSai ? oSai : d.kg == null ? "border-amber-300" : ""}`}
                          value={d.kgMotDonVi}
                          inputMode="decimal"
                          placeholder={d.goiY ? `≈ ${String(d.goiY.kg).replace(".", ",")}` : "?"}
                          title={
                            d.goiY
                              ? `${d.goiY.ghiChu}${d.kl != null && d.kg != null ? ` → ${formatQty(d.kl * d.kg)} kg` : ""}`
                              : "Không đọc ra quy cách — gõ kg một đơn vị"
                          }
                          onChange={(e) => sua(d.khoa, "kgMotDonVi", e.target.value)}
                        />
                      ) : null}
                    </td>
                  )}
                  <td className="px-1 py-0.5">
                    <input
                      className={`${o} text-right tabular-nums ${d.dgSai ? oSai : ""}`}
                      value={d.donGia}
                      inputMode="decimal"
                      onChange={(e) => sua(d.khoa, "donGia", e.target.value)}
                    />
                  </td>
                  <td className="px-1 py-0.5 text-right tabular-nums text-slate-700">
                    {d.kl != null && d.dg != null ? formatVND(d.kl * d.dg) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-1 py-0.5">
                    <input className={o} value={d.ghiChu} onChange={(e) => sua(d.khoa, "ghiChu", e.target.value)} />
                  </td>
                  <td className="px-1 py-0.5 text-right">
                    <button
                      type="button"
                      title="Xoá mục con"
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      onClick={() => xoa(d.khoa)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {donHang.map((m) => (
                <tr key={m.id} className="bg-emerald-50/40 text-slate-700" title="Món đơn hàng đã gắn — sửa ở màn đơn hàng">
                  <td className="px-2 py-1">
                    <span className="mr-1 rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800">ĐH</span>
                    {m.ten}
                  </td>
                  <td className="px-2 py-1">{m.donVi ?? ""}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.khoiLuong == null ? "" : formatQty(m.khoiLuong)}</td>
                  {laKg && (
                    <td className="px-2 py-1 text-right text-xs tabular-nums text-slate-500">
                      {m.kgTong != null
                        ? `${formatQty(m.kgTong)} kg`
                        : m.kgMotDonVi != null
                          ? `≈ ${String(m.kgMotDonVi).replace(".", ",")}`
                          : ""}
                    </td>
                  )}
                  <td className="px-2 py-1 text-right tabular-nums">{m.donGia == null ? "" : formatVND(m.donGia)}</td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {m.thanhTien != null ? formatVND(m.thanhTien) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-2 py-1 text-xs" colSpan={2}>
                    <Link href={`/projects/${projectId}/purchase#${m.orderId}`} className="text-blue-600 hover:underline">
                      Đơn {m.orderNo ?? "hàng"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 text-sm">
                <td colSpan={2} className="px-1 pt-2">
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" onClick={them}>
                    <Plus className="h-3.5 w-3.5" /> Thêm mục con
                  </button>
                </td>
                <td className="px-1 pt-2 text-right tabular-nums text-slate-600" title="Chỉ cộng khi mọi mục con cùng đơn vị đầu việc">
                  {tong.khoiLuong == null ? "—" : `${formatQty(tong.khoiLuong)} ${dong.unit ?? ""}`}
                </td>
                {laKg && <td />}
                <td className="px-1 pt-2 text-right tabular-nums text-slate-500">
                  {tong.donGia == null ? "" : `TB ${formatVND(Math.round(tong.donGia))}`}
                </td>
                <td className="px-1 pt-2 text-right font-semibold tabular-nums text-slate-900">
                  {tong.thanhTien == null ? "—" : formatVND(tong.thanhTien)}
                </td>
                <td colSpan={2} className="px-1 pt-2 text-xs text-amber-700">
                  {tong.soThieu > 0 ? `${tong.soThieu} mục thiếu KL / đơn giá — chưa vào tổng` : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {dang.length === 0 && donHang.length === 0 && (
          <p className="text-xs text-slate-400">
            Chưa có mục con {TEN[loai].toLowerCase()}. Lưu khi danh sách rỗng là gỡ hết mục con phía này.
          </p>
        )}
        {loi && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loi}</p>}
      </div>
    </Modal>
  );
}
