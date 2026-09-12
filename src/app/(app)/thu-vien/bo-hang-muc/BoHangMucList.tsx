"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { luuBoHangMuc, luuPhanBoHangMuc, xoaBoHangMuc } from "./actions";

export interface PhanView {
  id: string;
  ma: string;
  ten: string;
  loai: string;
  soDong: number;
  inChoKhach: boolean;
  maKhach: string | null;
  tenKhachHang: string | null;
  partCode: string;
  partName: string;
}

export interface BoView {
  id: string;
  ma: string;
  ten: string;
  loaiCongTrinh: string | null;
  moTa: string | null;
  active: boolean;
  soDong: number;
  soVatLieu: number;
  soGiaiDoan: number;
  soThanhToan: number;
  phan: PhanView[];
}

export function BoHangMucList({
  items,
  canEdit,
}: {
  items: BoView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [openBo, setOpenBo] = useState(false);
  const [editingBo, setEditingBo] = useState<BoView | null>(null);
  const [editingPhan, setEditingPhan] = useState<PhanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const toast = useToast();
  const confirm = useConfirm();

  function onLuuBo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuBoHangMuc(editingBo?.id ?? null, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setOpenBo(false);
        router.refresh();
      }
    });
  }

  function onLuuPhan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPhan) return;
    const form = new FormData(e.currentTarget);
    const id = editingPhan.id;
    setError(null);
    setPending(true);
    start(async () => {
      const res = await luuPhanBoHangMuc(id, form);
      setPending(false);
      if (!res.ok) setError(res.error);
      else {
        setEditingPhan(null);
        router.refresh();
      }
    });
  }

  async function onXoaBo(b: BoView) {
    if (!(await confirm(`Xóa bộ hạng mục "${b.ma} — ${b.ten}"? Kèm ${b.phan.length} phần và ${b.soDong} dòng công tác.`)))
      return;
    start(async () => {
      const res = await xoaBoHangMuc(b.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditingBo(null);
              setError(null);
              setOpenBo(true);
            }}
          >
            <Plus className="h-4 w-4" /> Thêm bộ hạng mục
          </Button>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Chưa có bộ hạng mục nào.
        </div>
      )}

      {items.map((b) => (
        <div key={b.id} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-sm text-slate-400">{b.ma}</span>
                <span className="font-semibold text-slate-900">{b.ten}</span>
                {b.loaiCongTrinh && (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                    {b.loaiCongTrinh}
                  </span>
                )}
                {!b.active && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                    Ngừng dùng
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {b.phan.length} phần · {b.soDong} dòng công tác · {b.soVatLieu} vật liệu
                · {b.soGiaiDoan} giai đoạn · {b.soThanhToan} đợt thanh toán
              </p>
              {b.moTa && <p className="text-sm text-slate-400">{b.moTa}</p>}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingBo(b);
                    setError(null);
                    setOpenBo(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => onXoaBo(b)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {b.phan.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Bộ này chưa khai phần nào — chưa áp vào dự toán được.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {b.phan.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-slate-400">{p.ma}</span>{" "}
                    <span className="font-medium text-slate-800">{p.ten}</span>
                    <span className="text-slate-400"> · {p.soDong} dòng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.inChoKhach ? (
                      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        <Printer className="h-3 w-3" />
                        {p.maKhach ? `${p.maKhach}. ` : ""}
                        {p.tenKhachHang ?? p.ten}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                        chỉ tính giá vốn
                      </span>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingPhan(p);
                          setError(null);
                        }}
                        title="Sửa phần"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* ----- Sửa bộ ----- */}
      <Modal
        open={openBo}
        onClose={() => setOpenBo(false)}
        title={editingBo ? "Sửa bộ hạng mục" : "Thêm bộ hạng mục"}
      >
        <form onSubmit={onLuuBo} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Mã *">
              <Input name="ma" defaultValue={editingBo?.ma ?? ""} placeholder="NHA-XUONG" required />
            </Field>
            <Field label="Tên bộ *" className="sm:col-span-2">
              <Input
                name="ten"
                defaultValue={editingBo?.ten ?? ""}
                placeholder="Nhà xưởng khung thép"
                required
              />
            </Field>
          </div>
          <Field label="Loại công trình (để trống = bộ dùng chung mọi loại)">
            <Input
              name="loaiCongTrinh"
              defaultValue={editingBo?.loaiCongTrinh ?? ""}
              placeholder="Nhà xưởng"
            />
          </Field>
          <Field label="Mô tả">
            <Textarea name="moTa" defaultValue={editingBo?.moTa ?? ""} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editingBo?.active ?? true}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Đang dùng (bộ ngừng dùng không hiện khi lập dự toán)
          </label>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenBo(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ----- Sửa phần ----- */}
      <Modal
        open={editingPhan !== null}
        onClose={() => setEditingPhan(null)}
        title={editingPhan ? `Phần ${editingPhan.ma} — ${editingPhan.ten}` : "Sửa phần"}
      >
        {editingPhan && (
          <form onSubmit={onLuuPhan} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Mã phần *">
                <Input name="ma" defaultValue={editingPhan.ma} required />
              </Field>
              <Field label="Tên (nội bộ) *" className="sm:col-span-2">
                <Input name="ten" defaultValue={editingPhan.ten} required />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="inChoKhach"
                defaultChecked={editingPhan.inChoKhach}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              In thành một hạng mục trên bản báo giá gửi khách
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Mã hạng mục (khách)">
                <Input name="maKhach" defaultValue={editingPhan.maKhach ?? ""} placeholder="01" />
              </Field>
              <Field label="Tên in cho khách (trống = dùng tên nội bộ)" className="sm:col-span-2">
                <Input
                  name="tenKhachHang"
                  defaultValue={editingPhan.tenKhachHang ?? ""}
                  placeholder="Khung thép và tôn phần mái"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Mã nhóm (I, II…)">
                <Input name="partCode" defaultValue={editingPhan.partCode} />
              </Field>
              <Field label="Tên nhóm trên bản in" className="sm:col-span-2">
                <Input name="partName" defaultValue={editingPhan.partName} />
              </Field>
            </div>

            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Mã phần cũng là chỗ bản gửi khách suy đơn giá m²: đơn giá của hạng mục này
              lấy từ tổng giá vốn của đúng phần mang mã đó.
            </p>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingPhan(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
