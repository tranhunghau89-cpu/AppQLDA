"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";
import { apDungDoiChieuThuVien, xemDoiChieuThuVien, type DongDoiChieu } from "./actions";

const NHAN_NGUON: Record<DongDoiChieu["nguon"], string> = {
  phan_mau: "theo mẫu đã áp",
  bo: "theo bộ hạng mục",
  ten: "trùng tên thư viện",
  da_co: "đã có mã",
};

/**
 * Đối chiếu dự toán thi công với thư viện công tác: gắn mã công việc cho dòng chưa có
 * và cập nhật đơn giá theo thư viện. Xem trước, người dùng tick dòng nào mới cập nhật dòng đó.
 */
export function DoiChieuThuVien({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [mo, setMo] = useState(false);
  const [dong, setDong] = useState<DongDoiChieu[] | null>(null);
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [dangChay, start] = useTransition();

  function moXem() {
    setMo(true);
    setDong(null);
    start(async () => {
      const r = await xemDoiChieuThuVien(projectId);
      if (!r.ok) {
        toast.error(r.error);
        setMo(false);
        return;
      }
      setDong(r.dong);
      setChon(new Set(r.dong.map((d) => d.id)));
    });
  }

  function apDung() {
    start(async () => {
      const r = await apDungDoiChieuThuVien(projectId, [...chon]);
      if (!r.ok) return toast.error(r.error);
      toast.success(`Đã cập nhật ${chon.size} dòng theo thư viện.`);
      setMo(false);
      router.refresh();
    });
  }

  const tick = (id: string) =>
    setChon((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <Button size="sm" variant="secondary" onClick={moXem} title="Gắn mã công việc và cập nhật đơn giá theo thư viện">
        <BookCheck className="h-4 w-4" /> Đối chiếu thư viện
      </Button>
      <Modal
        open={mo}
        onClose={() => setMo(false)}
        title="Đối chiếu với thư viện đơn giá"
        size="xl"
        footer={
          dong && dong.length > 0 ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Dòng tính giá theo mục con chỉ được gắn mã, giữ nguyên giá.
              </span>
              <Button disabled={dangChay || chon.size === 0} onClick={apDung}>
                {dangChay ? "Đang cập nhật…" : `Cập nhật ${chon.size} dòng`}
              </Button>
            </div>
          ) : null
        }
      >
        {!dong ? (
          <p className="py-6 text-center text-sm text-slate-500">Đang đối chiếu…</p>
        ) : dong.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Mọi dòng đã gắn mã và đúng giá thư viện — hoặc không tìm được mã chắc chắn cho dòng còn
            thiếu. Dòng chưa có mã thì gắn tay ở ô công việc trên bảng.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-500">
                <tr>
                  <th className="w-8 py-2">
                    <input
                      type="checkbox"
                      checked={chon.size === dong.length}
                      onChange={(e) => setChon(e.target.checked ? new Set(dong.map((d) => d.id)) : new Set())}
                    />
                  </th>
                  <th className="px-2 py-2 text-left">Hạng mục</th>
                  <th className="px-2 py-2 text-left">Công việc</th>
                  <th className="px-2 py-2 text-left">ĐVT</th>
                  <th className="px-2 py-2 text-left">Mã</th>
                  <th className="px-2 py-2 text-right">Đơn giá cũ</th>
                  <th className="px-2 py-2 text-right">Thư viện</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-center">
                      <input type="checkbox" checked={chon.has(d.id)} onChange={() => tick(d.id)} />
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{d.hangMuc ?? "—"}</td>
                    <td className="px-2 py-1.5">{d.ten}</td>
                    <td className="px-2 py-1.5 text-slate-500">{d.donVi}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">
                      {d.maCu ? d.ma : <span className="text-emerald-700">+ {d.ma}</span>}
                      <div className="font-sans text-[11px] text-slate-400">{NHAN_NGUON[d.nguon]}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{formatNumber(d.donGiaCu)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {d.donGiaMoi != null ? (
                        <span className={d.donGiaMoi > (d.donGiaCu ?? 0) ? "text-red-700" : "text-emerald-700"}>
                          {formatNumber(d.donGiaMoi)}
                        </span>
                      ) : (
                        <span className="text-slate-400">giữ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
