"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { formatNumber, formatQty } from "@/lib/utils";
import { luuBangBoc, xemTruocBangBoc, xoaBangBoc, type XemTruocBangBoc } from "./actions";
import type { EstimateRow } from "./EstimateEditor";

const TEN_LOAI: Record<string, string> = {
  KET_CAU: "Bảng thống kê kết cấu",
  TON: "Bảng bóc tôn theo trục",
};

/**
 * Gắn bảng bóc khối lượng chi tiết cho một đầu mục dự toán thi công.
 *
 * Luồng đúng nếp của trình nhập Excel sẵn có: chọn file → XEM TRƯỚC (chưa ghi gì) →
 * xác nhận. Thứ phải bày ra rõ nhất ở bước xem trước là khối lượng thiết kế sẽ đổi từ
 * số nào sang số nào — đó mới là hậu quả thật của việc bấm xác nhận.
 */
export function BangBocModal({
  projectId,
  dong,
  soChiTietHienCo,
  onClose,
}: {
  projectId: string;
  dong: EstimateRow;
  soChiTietHienCo: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [dangChay, start] = useTransition();
  const [xt, setXt] = useState<XemTruocBangBoc | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function chonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoi(null);
    setXt(null);
    const form = new FormData();
    form.set("file", f);
    start(async () => {
      const res = await xemTruocBangBoc(projectId, dong.id, form);
      if (!res.ok) {
        setLoi(res.error);
        return;
      }
      setXt(res.xemTruoc);
    });
  }

  function xacNhan() {
    if (!xt) return;
    start(async () => {
      const res = await luuBangBoc(projectId, dong.id, xt.duLieu);
      if (!res.ok) {
        setLoi(res.error);
        return;
      }
      toast.success(`Đã gắn bảng bóc ${xt.soDong} dòng.`);
      router.refresh();
      onClose();
    });
  }

  async function go() {
    const dongY = await confirm(
      `Gỡ bảng bóc ${soChiTietHienCo} dòng của "${dong.name}"? Khối lượng thiết kế giữ ` +
        "nguyên con số hiện tại và từ đó sửa tay được.",
      { title: "Gỡ bảng bóc", confirmLabel: "Gỡ" }
    );
    if (!dongY) return;
    start(async () => {
      const res = await xoaBangBoc(projectId, dong.id);
      if (!res.ok) {
        setLoi(res.error);
        return;
      }
      toast.success("Đã gỡ bảng bóc.");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Bảng bóc khối lượng — ${dong.name}`}
      footer={
        <>
          {soChiTietHienCo > 0 && !xt && (
            <Button variant="ghost" onClick={go} disabled={dangChay}>
              Gỡ bảng bóc
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Đóng
          </Button>
          {xt && xt.soDong > 0 && (
            <Button onClick={xacNhan} disabled={dangChay}>
              {dangChay ? "Đang ghi…" : "Xác nhận & đặt khối lượng"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Đầu mục: <strong>{dong.name}</strong> · đơn vị{" "}
          <strong>{dong.unit ?? "—"}</strong> · khối lượng thiết kế đang lưu{" "}
          <strong>{dong.designQty == null ? "—" : formatQty(dong.designQty)}</strong>.
          {soChiTietHienCo > 0 && (
            <>
              {" "}
              Đang có bảng bóc <strong>{soChiTietHienCo} dòng</strong> — nhập file mới sẽ
              THAY toàn bộ.
            </>
          )}
        </p>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={chonFile}
            className="hidden"
          />
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={dangChay}>
            <Upload className="h-4 w-4" /> {dangChay && !xt ? "Đang đọc…" : "Chọn file Excel"}
          </Button>
          <span className="ml-2 text-xs text-slate-500">
            Nhận bảng thống kê kết cấu (Mã Số · Qui Cách · KL Đơn) hoặc bảng bóc tôn
            (STT · Chiều dài · SL).
          </span>
        </div>

        {loi && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loi}</p>
        )}

        {xt && (
          <>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <div className="text-slate-600">
                {TEN_LOAI[xt.loai ?? ""] ?? "Không nhận ra định dạng"} ·{" "}
                <strong>{xt.soDong}</strong> dòng
                {xt.tenCongTrinh ? ` · ${xt.tenCongTrinh}` : ""}
                {xt.hangMuc ? ` · ${xt.hangMuc}` : ""}
              </div>
              <div className="mt-1 text-slate-700">
                Khối lượng thiết kế:{" "}
                <span className="text-slate-500">
                  {xt.dangLuu == null ? "chưa có" : formatQty(xt.dangLuu)}
                </span>{" "}
                →{" "}
                <strong className="text-blue-700">
                  {xt.tong == null ? "chưa tính được" : formatQty(xt.tong)}{" "}
                  {xt.donVi ?? ""}
                </strong>
                <span className="text-slate-500"> — {xt.cachTinh}</span>
              </div>
            </div>

            {xt.canhBao.length > 0 && (
              <ul className="space-y-0.5 text-xs text-amber-700">
                {xt.canhBao.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            )}

            {xt.dongMau.length > 0 && (
              <div className="max-h-[40vh] overflow-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[36rem] text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Nhóm</th>
                      <th className="px-2 py-1.5 text-left font-medium">Mã</th>
                      <th className="px-2 py-1.5 text-left font-medium">Quy cách</th>
                      <th className="px-2 py-1.5 text-right font-medium">SL</th>
                      <th className="px-2 py-1.5 text-right font-medium">Dài (mm)</th>
                      <th className="px-2 py-1.5 text-right font-medium">KL đơn</th>
                      <th className="px-2 py-1.5 text-right font-medium">DT đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xt.dongMau.map((d, i) => (
                      <tr key={`${d.maSo ?? ""}-${i}`} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-500">{d.nhom ?? "—"}</td>
                        <td className="px-2 py-1 font-mono text-slate-700">{d.maSo ?? "—"}</td>
                        <td className="px-2 py-1 text-slate-600">{d.quyCach ?? "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {d.soLuong == null ? "—" : formatQty(d.soLuong)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                          {d.dai == null ? "—" : formatNumber(d.dai)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                          {d.klDon == null ? "—" : formatQty(d.klDon)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-500">
                          {d.dienTichDon == null ? "—" : formatQty(d.dienTichDon)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {xt.soDong > xt.dongMau.length && (
                  <p className="px-2 py-1.5 text-xs text-slate-400">
                    … và {xt.soDong - xt.dongMau.length} dòng nữa.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
