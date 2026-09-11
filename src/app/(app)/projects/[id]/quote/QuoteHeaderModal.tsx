"use client";

import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "./ModalActions";
import { saveQuote } from "./actions";
import type { ChuBaoGia } from "@/lib/quoteOwner";
import type { QuoteView } from "./types";

export function QuoteHeaderModal({
  chu,
  editing,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  editing: QuoteView | null;
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
        <Field label="Ghi chú">
          <Textarea name="note" defaultValue={editing?.note ?? ""} />
        </Field>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
