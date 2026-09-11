"use client";

import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { QUOTE_SPEC_GROUP, VAT_TU_TAG } from "@/lib/constants";
import { ModalActions } from "../quote/ModalActions";
import { saveSpec } from "./actions";
import type { SpecView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

export interface SpecModalState {
  quoteId: string;
  editing: SpecView | null;
  defaultGroup: string;
}

export function SpecModal({
  chu,
  state,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  state: SpecModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, quoteId } = state;
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveSpec(chu, quoteId, editing?.id ?? null, form));
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Sửa vật liệu" : "Thêm vật liệu"}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Nhóm *">
          <Select name="groupCode" defaultValue={editing?.groupCode ?? state.defaultGroup}>
            {QUOTE_SPEC_GROUP.map((g) => (
              <option key={g.value} value={g.value}>
                {g.value} — {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Loại vật tư">
          <Select name="tag" defaultValue={editing?.tag ?? ""}>
            <option value="">— Dùng chung (luôn in) —</option>
            {VAT_TU_TAG.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-400">
            Dòng này chỉ in ra khi báo giá có hạng mục dùng loại vật tư đó. Để “Dùng
            chung” cho những thứ công trình nào cũng có (que hàn, sơn, bulong, keo vít).
          </p>
        </Field>

        <Field label="Nội dung *">
          <Input name="name" defaultValue={editing?.name ?? ""} required />
        </Field>
        <Field label="Thông số kỹ thuật">
          <Input name="spec" defaultValue={editing?.spec ?? ""} placeholder="fy = 2.450 kG/cm2" />
        </Field>
        <Field label="Ghi chú và xuất xứ">
          <Input
            name="origin"
            defaultValue={editing?.origin ?? ""}
            placeholder="Q235 hoặc tương đương"
          />
        </Field>

        <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3">
          <input
            type="checkbox"
            name="inDescription"
            defaultChecked={editing?.inDescription ?? false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Nhắc lại dòng này dưới tên hạng mục
            <span className="mt-0.5 block text-xs text-slate-400">
              Bảng vật liệu bên dưới đã kể đủ. Chỉ bật cho thứ khách cần thấy ngay ở
              hạng mục — thường là dòng tôn. Bật hết thì mô tả dài gấp ba báo giá thật.
            </span>
          </span>
        </label>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
