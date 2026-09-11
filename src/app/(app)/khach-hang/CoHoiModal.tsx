"use client";

import { useState } from "react";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../projects/[id]/quote/ModalActions";
import { CO_HOI_TRANG_THAI } from "@/lib/constants";
import { saveCoHoi } from "./coHoiActions";
import type { CoHoiRow } from "./CoHoiPanel";

export function CoHoiModal({
  khachHangId,
  editing,
  onClose,
  onDone,
}: {
  khachHangId: string;
  editing: CoHoiRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);
  const [trangThai, setTrangThai] = useState(editing?.trangThai ?? "MOI");

  // Đã thành dự án thì trạng thái khóa cứng ở "Đã ký hợp đồng".
  const daKy = Boolean(editing?.projectId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveCoHoi(khachHangId, editing?.id ?? null, form));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa công trình chào giá" : "Thêm công trình chào giá"}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Tên công trình *">
          <Input
            name="tenCongTrinh"
            defaultValue={editing?.tenCongTrinh ?? ""}
            required
            placeholder="Nhà xưởng Hồng Ngự"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Địa điểm">
              <Input name="diaDiem" defaultValue={editing?.diaDiem ?? ""} />
            </Field>
          </div>
          <Field label="Loại công trình">
            <Input
              name="buildingType"
              defaultValue={editing?.buildingType ?? ""}
              placeholder="Nhà xưởng"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Diện tích (m²)">
            <Input name="area" type="number" step="any" defaultValue={editing?.area ?? ""} />
          </Field>
          <Field label="Bước khung K">
            <Input name="kK" type="number" step="any" defaultValue={editing?.kK ?? ""} />
          </Field>
          <Field label="Chiều dài L">
            <Input name="kL" type="number" step="any" defaultValue={editing?.kL ?? ""} />
          </Field>
          <Field label="Chiều cao H">
            <Input name="kH" type="number" step="any" defaultValue={editing?.kH ?? ""} />
          </Field>
        </div>

        <p className="text-xs text-slate-400">
          Diện tích là mẫu số khi suy đơn giá m² từ dự toán chi tiết; loại công trình dùng
          để chọn sẵn mẫu báo giá. Chưa biết thì để trống, điền sau cũng được.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Trạng thái">
            <Select
              name="trangThai"
              value={trangThai}
              disabled={daKy}
              onChange={(e) => setTrangThai(e.target.value)}
            >
              {CO_HOI_TRANG_THAI.filter((t) => t.value !== "KY_HD" || daKy).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          {trangThai === "MAT" && (
            <Field label="Lý do mất khách">
              <Input
                name="lyDoMat"
                defaultValue={editing?.lyDoMat ?? ""}
                placeholder="Giá cao hơn đối thủ / khách hoãn đầu tư…"
              />
            </Field>
          )}
        </div>

        {daKy && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Công trình này đã thành dự án nên trạng thái khóa ở “Đã ký hợp đồng”.
          </p>
        )}

        <Field label="Ghi chú">
          <Textarea name="note" rows={2} defaultValue={editing?.note ?? ""} />
        </Field>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
