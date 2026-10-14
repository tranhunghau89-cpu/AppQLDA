"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { saveProject } from "../actions";

export interface ThongTinDuAn {
  id: string;
  code: string;
  name: string;
  buildingType: string | null;
  status: string;
  location: string | null;
  khuVucId: string | null;
  customerId: string | null;
  startDate: string | null;
  endDate: string | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
  area: number | null;
  salePrice: number | null;
  note: string | null;
}

const ngay = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/**
 * Sửa thông tin chung của dự án ngay trên trang chi tiết (chủ đầu tư, công trình, ngày…).
 * Dùng lại saveProject: form phải gửi ĐỦ mọi trường, kể cả trạng thái (gửi ẩn — đổi
 * trạng thái có nút riêng ở đầu trang). Giá bán bị khoá khi đã có hợp đồng.
 */
export function SuaThongTinDuAn({
  duAn,
  customers,
  khuVucs,
  giaBanKhoa,
}: {
  duAn: ThongTinDuAn;
  customers: { id: string; name: string }[];
  khuVucs: { id: string; ma: string; ten: string }[];
  giaBanKhoa: boolean;
}) {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoi(null);
    start(async () => {
      const r = await saveProject(duAn.id, form);
      if (!r.ok) return setLoi(r.error);
      setMo(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setLoi(null);
          setMo(true);
        }}
      >
        <Pencil className="h-4 w-4" /> Sửa thông tin
      </Button>
      <Modal open={mo} onClose={() => setMo(false)} title={`Sửa thông tin ${duAn.code}`} size="lg">
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="status" value={duAn.status} />
          <Field label="Chủ đầu tư">
            <div className="flex gap-2">
              <Select name="customerId" defaultValue={duAn.customerId ?? ""} className="flex-1">
                <option value="">— Chưa gán —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Link
                href="/customers"
                target="_blank"
                className="inline-flex shrink-0 items-center rounded-md px-2 text-sm text-blue-600 hover:underline"
              >
                + Thêm CĐT mới
              </Link>
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mã dự án *">
              <Input name="code" defaultValue={duAn.code} required />
            </Field>
            <Field label="Tên dự án *">
              <Input name="name" defaultValue={duAn.name} required />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Loại công trình">
              <Input name="buildingType" defaultValue={duAn.buildingType ?? ""} />
            </Field>
            <Field label="Vị trí">
              <Input name="location" defaultValue={duAn.location ?? ""} />
            </Field>
          </div>
          <Field label="Khu vực (nhóm NCC và đơn giá được gợi ý)">
            <Select name="khuVucId" defaultValue={duAn.khuVucId ?? ""}>
              <option value="">— Chưa chọn —</option>
              {khuVucs.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ma} — {k.ten}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bước khung K">
              <Input name="kK" type="number" step="any" defaultValue={duAn.kK ?? ""} />
            </Field>
            <Field label="Chiều dài L">
              <Input name="kL" type="number" step="any" defaultValue={duAn.kL ?? ""} />
            </Field>
            <Field label="Chiều cao H">
              <Input name="kH" type="number" step="any" defaultValue={duAn.kH ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Diện tích (m²)">
              <Input name="area" type="number" step="any" defaultValue={duAn.area ?? ""} />
            </Field>
            <Field label={giaBanKhoa ? "Giá bán (₫) — theo hợp đồng" : "Giá bán (₫)"}>
              <Input
                name="salePrice"
                type="number"
                step="any"
                defaultValue={duAn.salePrice ?? ""}
                readOnly={giaBanKhoa}
                className={giaBanKhoa ? "bg-slate-50 text-slate-500" : undefined}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ngày bắt đầu">
              <Input name="startDate" type="date" defaultValue={ngay(duAn.startDate)} />
            </Field>
            <Field label="Ngày hoàn thành">
              <Input name="endDate" type="date" defaultValue={ngay(duAn.endDate)} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea name="note" defaultValue={duAn.note ?? ""} />
          </Field>
          {loi && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{loi}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMo(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
