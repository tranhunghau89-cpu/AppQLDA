"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TRANG_THAI_BAO_HANH } from "@/lib/baoHanhNhan";
import { capNhatPhieuBaoHanh, taoPhieuBaoHanh, xoaPhieuBaoHanh } from "./baoHanhActions";

export interface PhieuView {
  id: string;
  tieuDe: string;
  moTa: string | null;
  viTri: string | null;
  nguoiBao: string | null;
  ngayBao: string;
  mucDo: string;
  phuTrachId: string | null;
  phuTrachTen: string | null;
  hanXuLy: string | null;
  trangThai: string;
  ketQua: string | null;
  taoBoiTen: string;
}

type Nguoi = { id: string; name: string };

const o = "h-9 w-full rounded-md border border-slate-300 px-2 text-sm";
const ngayVN = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");
const ngayInput = (s: string | null) => (s ? s.slice(0, 10) : "");

export function BaoHanh({
  projectId,
  phieu,
  nguoiDung,
  toiLa,
  canEdit,
  canDelete,
  nowMs,
}: {
  projectId: string;
  phieu: PhieuView[];
  nguoiDung: Nguoi[];
  toiLa: string;
  canEdit: boolean;
  canDelete: boolean;
  nowMs: number;
}) {
  const [moTao, setMoTao] = useState(false);
  const [sua, setSua] = useState<PhieuView | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setMoTao(true)}>+ Ghi nhận bảo hành</Button>
      </div>
      {phieu.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
          Chưa có yêu cầu bảo hành nào.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {phieu.map((p) => {
            const mo = p.trangThai === "MOI" || p.trangThai === "DANG_XU_LY";
            const tre = mo && p.hanXuLy && new Date(p.hanXuLy).getTime() < nowMs;
            const tt = TRANG_THAI_BAO_HANH[p.trangThai];
            return (
              <li key={p.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.mucDo === "KHAN" && <Badge tone="red">Khẩn</Badge>}
                    <span className="font-medium text-slate-900">{p.tieuDe}</span>
                    <Badge tone={tt?.tone ?? "slate"}>{tt?.label ?? p.trangThai}</Badge>
                    {tre && <Badge tone="red">Quá hạn</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.viTri ? `${p.viTri} · ` : ""}Báo {ngayVN(p.ngayBao)}
                    {p.nguoiBao ? ` bởi ${p.nguoiBao}` : ""} · Phụ trách: {p.phuTrachTen ?? "chưa giao"} · Hạn:{" "}
                    {ngayVN(p.hanXuLy)}
                  </p>
                  {p.moTa && <p className="mt-1 whitespace-pre-line text-slate-700">{p.moTa}</p>}
                  {p.ketQua && <p className="mt-1 text-slate-600">→ {p.ketQua}</p>}
                </div>
                {(canEdit || p.phuTrachId === toiLa) && (
                  <Button size="sm" variant="outline" onClick={() => setSua(p)}>Cập nhật</Button>
                )}
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (confirm(`Xóa phiếu "${p.tieuDe}"?`)) await xoaPhieuBaoHanh(p.id);
                    }}
                  >
                    Xóa
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {moTao && <FormTao projectId={projectId} nguoiDung={nguoiDung} onClose={() => setMoTao(false)} />}
      {sua && <FormCapNhat p={sua} nguoiDung={nguoiDung} onClose={() => setSua(null)} />}
    </div>
  );
}

function FormTao({ projectId, nguoiDung, onClose }: { projectId: string; nguoiDung: Nguoi[]; onClose: () => void }) {
  const [v, setV] = useState({
    tieuDe: "", moTa: "", viTri: "", nguoiBao: "", ngayBao: new Date().toISOString().slice(0, 10),
    mucDo: "THUONG" as "KHAN" | "THUONG", phuTrachId: "", hanXuLy: "",
  });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, start] = useTransition();
  const dat = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      title="Ghi nhận yêu cầu bảo hành"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button
            disabled={dang}
            onClick={() =>
              start(async () => {
                const r = await taoPhieuBaoHanh(projectId, v);
                if (r.ok) onClose();
                else setLoi(r.error);
              })
            }
          >
            Lưu
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="sm:col-span-2">Lỗi cần bảo hành *<input className={o} value={v.tieuDe} onChange={dat("tieuDe")} placeholder="VD: Thấm trần WC tầng 2" /></label>
        <label>Vị trí / hạng mục<input className={o} value={v.viTri} onChange={dat("viTri")} /></label>
        <label>Người báo (CĐT, SĐT)<input className={o} value={v.nguoiBao} onChange={dat("nguoiBao")} /></label>
        <label>Ngày báo<input type="date" className={o} value={v.ngayBao} onChange={dat("ngayBao")} /></label>
        <label>Mức độ
          <select className={o} value={v.mucDo} onChange={dat("mucDo")}>
            <option value="THUONG">Thường</option>
            <option value="KHAN">Khẩn</option>
          </select>
        </label>
        <label>Giao cho
          <select className={o} value={v.phuTrachId} onChange={dat("phuTrachId")}>
            <option value="">— Chưa giao —</option>
            {nguoiDung.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>Hạn xử lý<input type="date" className={o} value={v.hanXuLy} onChange={dat("hanXuLy")} /></label>
        <label className="sm:col-span-2">Mô tả
          <textarea rows={3} className="w-full rounded-md border border-slate-300 p-2" value={v.moTa} onChange={dat("moTa")} />
        </label>
        {loi && <p className="text-red-600 sm:col-span-2">{loi}</p>}
      </div>
    </Modal>
  );
}

function FormCapNhat({ p, nguoiDung, onClose }: { p: PhieuView; nguoiDung: Nguoi[]; onClose: () => void }) {
  const [v, setV] = useState({
    trangThai: p.trangThai as "MOI" | "DANG_XU_LY" | "DA_XONG" | "TU_CHOI",
    phuTrachId: p.phuTrachId ?? "",
    hanXuLy: ngayInput(p.hanXuLy),
    ketQua: p.ketQua ?? "",
  });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, start] = useTransition();
  const dat = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cập nhật: ${p.tieuDe}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button
            disabled={dang}
            onClick={() =>
              start(async () => {
                const r = await capNhatPhieuBaoHanh(p.id, v);
                if (r.ok) onClose();
                else setLoi(r.error);
              })
            }
          >
            Lưu
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label>Trạng thái
          <select className={o} value={v.trangThai} onChange={dat("trangThai")}>
            {Object.entries(TRANG_THAI_BAO_HANH).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </label>
        <label>Giao cho
          <select className={o} value={v.phuTrachId} onChange={dat("phuTrachId")}>
            <option value="">— Chưa giao —</option>
            {nguoiDung.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>Hạn xử lý<input type="date" className={o} value={v.hanXuLy} onChange={dat("hanXuLy")} /></label>
        <label className="sm:col-span-2">Kết quả / lý do (bắt buộc khi Đã xong hoặc Từ chối)
          <textarea rows={3} className="w-full rounded-md border border-slate-300 p-2" value={v.ketQua} onChange={dat("ketQua")} />
        </label>
        {loi && <p className="text-red-600 sm:col-span-2">{loi}</p>}
      </div>
    </Modal>
  );
}
