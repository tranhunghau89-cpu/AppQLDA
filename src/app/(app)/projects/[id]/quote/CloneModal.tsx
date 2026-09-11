"use client";

import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "./ModalActions";
import { cloneQuoteFrom } from "./actions";
import type { CloneSource } from "./types";

export function CloneModal({
  projectId,
  cloneSources,
  onClose,
  onDone,
}: {
  projectId: string;
  cloneSources: CloneSource[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sourceId = String(form.get("sourceId") ?? "");
    const mk = String(form.get("markup") ?? "");
    if (!sourceId) {
      // Select không dùng được `required` với option rỗng nên chặn tay ở đây.
      run(async () => ({ ok: false, error: "Hãy chọn báo giá nguồn." }));
      return;
    }
    run(() => cloneQuoteFrom(projectId, sourceId, mk === "" ? null : Number(mk)));
  }

  return (
    <Modal open onClose={onClose} title="Tạo báo giá từ dự án khác">
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-500">
          Sao chép cấu trúc &amp; khối lượng từ báo giá đã có, rồi lấy lại đơn giá mới nhất từ bảng
          đơn giá.
        </p>
        <Field label="Báo giá nguồn *">
          <Select name="sourceId" defaultValue="">
            <option value="">— Chọn báo giá —</option>
            {cloneSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hệ số TL (để trống = giữ theo nguồn)">
          <Input name="markup" type="number" step="any" placeholder="vd 1.2" />
        </Field>
        <ModalActions
          error={error}
          pending={pending}
          onCancel={onClose}
          submitLabel="Tạo báo giá"
          pendingLabel="Đang tạo…"
        />
      </form>
    </Modal>
  );
}
