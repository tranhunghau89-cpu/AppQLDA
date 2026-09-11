"use client";

import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../quote/ModalActions";
import { saveLine } from "./actions";
import type { LineView } from "./types";

export interface LineModalState {
  quoteId: string;
  editing: LineView | null;
}

export function LineModal({
  projectId,
  state,
  onClose,
  onDone,
}: {
  projectId: string;
  state: LineModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, quoteId } = state;
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveLine(projectId, quoteId, editing?.id ?? null, form));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa hạng mục" : "Thêm hạng mục"}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Mã phần">
            <Input name="partCode" defaultValue={editing?.partCode ?? "I"} />
          </Field>
          <div className="col-span-1 sm:col-span-2">
            <Field label="Tên phần">
              <Input name="partName" defaultValue={editing?.partName ?? "Phần kết cấu thép"} />
            </Field>
          </div>
          <Field label="STT">
            <Input name="code" defaultValue={editing?.code ?? ""} placeholder="01" />
          </Field>
        </div>

        <Field label="Nội dung công việc *">
          <Input name="name" defaultValue={editing?.name ?? ""} required />
        </Field>
        <Field label="Diễn giải (mỗi dòng một gạch đầu dòng khi in)">
          <Textarea
            name="detail"
            rows={3}
            defaultValue={editing?.detail ?? ""}
            placeholder={"- Gia công sản xuất theo bản vẽ thiết kế.\n- Tôn mái là tôn Đông Á dày 0,45 mm mạ màu, 5 sóng công nghiệp."}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Đơn vị">
            <Input name="unit" defaultValue={editing?.unit ?? "m2"} />
          </Field>
          <Field label="Tổng khối lượng">
            <Input name="qty" type="number" step="any" defaultValue={editing?.qty ?? ""} />
          </Field>
          <Field label="Đơn giá">
            <Input
              name="unitPrice"
              type="number"
              step="any"
              defaultValue={editing?.unitPrice ?? ""}
            />
          </Field>
        </div>

        <Field label="Thành tiền chốt cứng (để trống = khối lượng × đơn giá)">
          <Input
            name="amount"
            type="number"
            step="any"
            defaultValue={editing?.amount ?? ""}
            placeholder="Chỉ điền cho dòng khoán, vd cửa đẩy chớp 6 cái"
          />
        </Field>

        <Field label="Ghi chú / Quy cách">
          <Input name="note" defaultValue={editing?.note ?? ""} />
        </Field>

        {editing?.sourceSectionId && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Đơn giá dòng này được suy ra từ báo giá chi tiết. Sửa tay ở đây sẽ đánh dấu là
            “đã đè giá”, và lần “Tính lại đơn giá” sau sẽ bỏ qua dòng này.
          </p>
        )}

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
