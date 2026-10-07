"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";
import type { DongBangGia, KetQuaSoSanh } from "@/lib/thuVien/bangGia";
import { capNhatBangGia, xemTruocExcelBangGia } from "./bangGiaActions";

export const homNay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Danh sách mã đổi giá — dùng chung cho xem trước Excel và xác nhận sửa trên lưới. */
export function BangThayDoi({ soSanh }: { soSanh: KetQuaSoSanh }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        <b>{soSanh.thayDoi.length}</b> mã đổi giá · {soSanh.khongDoi} mã giữ nguyên
      </p>
      {soSanh.loi.length > 0 && (
        <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {soSanh.loi.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {soSanh.thayDoi.length > 0 && (
        <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-1.5 text-left">Mã</th>
                <th className="px-3 py-1.5 text-right">Giá cũ</th>
                <th className="px-3 py-1.5 text-right">Giá mới</th>
                <th className="px-3 py-1.5 text-right">Chênh</th>
              </tr>
            </thead>
            <tbody>
              {soSanh.thayDoi.map((t) => {
                const cu = t.cu?.donGia ?? null;
                const pt = cu ? ((t.moi.donGia - cu) / cu) * 100 : null;
                return (
                  <tr key={t.ma} className="border-t border-slate-100">
                    <td className="px-3 py-1 font-mono">{t.ma}</td>
                    <td className="px-3 py-1 text-right text-slate-400">
                      {cu == null ? "—" : formatNumber(cu)}
                    </td>
                    <td className="px-3 py-1 text-right font-medium text-blue-700">
                      {formatNumber(t.moi.donGia)}
                    </td>
                    <td
                      className={`px-3 py-1 text-right text-xs ${
                        pt == null ? "text-slate-400" : pt > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {pt == null ? "mới" : `${pt > 0 ? "+" : ""}${pt.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function NhapExcelBangGia({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [ngay, setNgay] = useState(homNay);
  const [ghiChu, setGhiChu] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [xem, setXem] = useState<{ dong: DongBangGia[]; soSanh: KetQuaSoSanh } | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);

  function dong() {
    setXem(null);
    setFile(null);
    setLoi(null);
    onClose();
  }

  async function doc() {
    if (!file) return setLoi("Chưa chọn file.");
    const f = new FormData();
    f.set("file", file);
    f.set("hieuLucTu", ngay);
    setDangChay(true);
    setLoi(null);
    const res = await xemTruocExcelBangGia(f);
    setDangChay(false);
    if (!res.ok) setLoi(res.error);
    else setXem({ dong: res.dong, soSanh: res.soSanh });
  }

  async function ghi() {
    if (!xem) return;
    setDangChay(true);
    const res = await capNhatBangGia({ dong: xem.dong, hieuLucTu: ngay, ghiChu, nguon: "IMPORT_EXCEL" });
    setDangChay(false);
    if (!res.ok) return setLoi(res.error);
    toast.success(`Đã cập nhật giá cho ${res.soMa} mã.`);
    dong();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={dong}
      title="Nhập bảng giá từ Excel"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={dong}>
            Hủy
          </Button>
          {xem ? (
            <Button onClick={ghi} disabled={dangChay || xem.soSanh.thayDoi.length === 0}>
              Cập nhật {xem.soSanh.thayDoi.length} mã
            </Button>
          ) : (
            <Button onClick={doc} disabled={dangChay || !file}>
              Đọc file
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Tải bảng giá về bằng nút <b>Tải Excel</b>, sửa các cột Vật tư / NC + Máy / Hệ số / Đơn giá
          rồi nộp lại. Đơn giá để trống thì tính bằng (Vật tư + NC) × Hệ số. Chỉ mã có giá khác mới
          tạo bản giá mới; giá cũ vẫn giữ trong lịch sử.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ngày hiệu lực của phiên bản giá">
            <Input type="date" value={ngay} onChange={(e) => { setNgay(e.target.value); setXem(null); }} />
          </Field>
          <Field label="Ghi chú phiên bản">
            <Input value={ghiChu} placeholder="VD: Giá thép tháng 10/2026" onChange={(e) => setGhiChu(e.target.value)} />
          </Field>
        </div>
        <Field label="File Excel (.xlsx)">
          <Input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setXem(null); }}
          />
        </Field>
        {loi && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loi}</p>}
        {xem && <BangThayDoi soSanh={xem.soSanh} />}
      </div>
    </Modal>
  );
}
