"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { formatVND } from "@/lib/utils";
import {
  doXuongDuToanThiCong,
  xemTruocDoXuong,
  type XemTruocDoXuong,
} from "./actions";

export interface BaoGiaChonDuoc {
  id: string;
  title: string;
  ngay: string | null;
}

export function DoXuongTuBaoGia({
  projectId,
  baoGia,
}: {
  projectId: string;
  baoGia: BaoGiaChonDuoc[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quoteId, setQuoteId] = useState(baoGia[0]?.id ?? "");
  const [xemTruoc, setXemTruoc] = useState<XemTruocDoXuong | null>(null);
  const [daHieu, setDaHieu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function nap(id: string) {
    setQuoteId(id);
    setXemTruoc(null);
    setDaHieu(false);
    setError(null);
    if (!id) return;
    start(async () => {
      const res = await xemTruocDoXuong(projectId, id);
      if (!res.ok) setError(res.error);
      else setXemTruoc(res.data);
    });
  }

  function moModal() {
    setOpen(true);
    nap(baoGia[0]?.id ?? "");
  }

  function chay() {
    setError(null);
    start(async () => {
      const res = await doXuongDuToanThiCong(projectId, quoteId);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (baoGia.length === 0) return null;

  // Dự toán thi công đã có dòng thì bắt tích xác nhận: thao tác này CHỈ THÊM, không
  // thay thế, và người dùng cần thấy rõ điều đó trước khi bấm.
  const canXacNhan = (xemTruoc?.soDongDaCo ?? 0) > 0;
  const chayDuoc = !!xemTruoc && xemTruoc.soDong > 0 && (!canXacNhan || daHieu);

  return (
    <>
      <Button variant="outline" size="sm" onClick={moModal}>
        <ArrowDownToLine className="h-4 w-4" /> Đổ từ dự toán chào giá
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Đổ xuống dự toán thi công"
        size="lg"
      >
        <div className="space-y-4">
          <Field label="Bản dự toán chào giá">
            <Select value={quoteId} onChange={(e) => nap(e.target.value)}>
              {baoGia.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                  {q.ngay ? ` — ${q.ngay}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {pending && !xemTruoc && (
            <p className="text-sm text-slate-500">Đang đọc bản dự toán…</p>
          )}

          {xemTruoc && (
            <>
              <div className="rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Hạng mục sẽ tạo</th>
                      <th className="px-3 py-2 text-right font-medium">Số dòng</th>
                      <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {xemTruoc.hangMuc.map((h, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-800">
                          {h.ma && (
                            <span className="mr-1.5 font-mono text-slate-400">{h.ma}</span>
                          )}
                          {h.ten}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600">{h.soDong}</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">
                          {formatVND(h.thanhTien)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {xemTruoc.hangMuc.length} hạng mục
                        {xemTruoc.khuVucTen ? ` · khu vực ${xemTruoc.khuVucTen}` : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">
                        {xemTruoc.soDong}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        {formatVND(xemTruoc.tongTien)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {xemTruoc.soDongThieuKhoiLuong > 0 && (
                <p className="text-sm text-slate-500">
                  {xemTruoc.soDongThieuKhoiLuong} dòng chưa có khối lượng — vẫn đổ xuống
                  để giữ đủ đầu việc, điền sau trên bảng dự toán.
                </p>
              )}

              {xemTruoc.canhBao.length > 0 && (
                <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {xemTruoc.canhBao.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}

              {canXacNhan && (
                <label className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={daHieu}
                    onChange={(e) => setDaHieu(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600"
                  />
                  <span>
                    Dự toán thi công đang có <strong>{xemTruoc.soDongDaCo} dòng</strong>.
                    Đổ xuống sẽ <strong>thêm mới</strong>, không thay thế và không xóa gì —
                    tôi đã hiểu.
                  </span>
                </label>
              )}

              {xemTruoc.soDong === 0 && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Bản dự toán này không có dòng nào để đổ xuống.
                </p>
              )}
            </>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={chay} disabled={pending || !chayDuoc}>
              {pending ? "Đang đổ…" : "Đổ xuống"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
