"use client";

import { Input, Textarea, Field, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "./ModalActions";
import { saveQuote } from "./actions";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import type { QuoteView } from "./types";

export function QuoteHeaderModal({
  chu,
  editing,
  khuVucs,
  khuVucMacDinh,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  editing: QuoteView | null;
  khuVucs: { id: string; ma: string; ten: string }[];
  /** Khu vực của dự án — chọn sẵn khi tạo bản mới. */
  khuVucMacDinh: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveQuote(chu, editing?.id ?? null, form));
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Sửa báo giá" : "Thêm báo giá"}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Tiêu đề *">
          <Input name="title" defaultValue={editing?.title ?? ""} required />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Kính gửi">
            <Input name="recipient" defaultValue={editing?.recipient ?? ""} />
          </Field>
          <Field label="Địa điểm">
            <Input name="location" defaultValue={editing?.location ?? ""} />
          </Field>
        </div>
        <Field label="Hạng mục">
          <Input name="scope" defaultValue={editing?.scope ?? ""} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ngày báo giá">
            <Input
              name="quoteDate"
              type="date"
              defaultValue={editing?.quoteDate ? editing.quoteDate.slice(0, 10) : ""}
            />
          </Field>
          <Field label="Hệ số TL (đơn giá bán = giá gốc × TL)">
            <Input name="markup" type="number" step="any" defaultValue={editing?.markup ?? 1} />
          </Field>
        </div>
        {/*
          Khu vực nằm ở BẢN dự toán chứ không đọc qua dự án: một bản dự toán sống được
          ở cơ hội chào giá, lúc đó chưa có dự án nào để hỏi. Tạo từ dự án thì ô này
          chọn sẵn khu vực của dự án.
        */}
        <Field label="Khu vực (dùng để tra đơn giá thư viện)">
          <Select name="khuVucId" defaultValue={editing?.khuVucId ?? khuVucMacDinh ?? ""}>
            <option value="">Không theo khu vực — dùng giá chung</option>
            {khuVucs.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ma} — {k.ten}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ghi chú">
          <Textarea name="note" defaultValue={editing?.note ?? ""} />
        </Field>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
