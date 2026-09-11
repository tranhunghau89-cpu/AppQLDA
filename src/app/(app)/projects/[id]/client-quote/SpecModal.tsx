"use client";

import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { QUOTE_SPEC_GROUP } from "@/lib/constants";
import { ModalActions } from "../quote/ModalActions";
import { saveSpec } from "./actions";
import type { SpecView } from "./types";

export interface SpecModalState {
  quoteId: string;
  editing: SpecView | null;
  defaultGroup: string;
}

export function SpecModal({
  projectId,
  state,
  onClose,
  onDone,
}: {
  projectId: string;
  state: SpecModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, quoteId } = state;
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveSpec(projectId, quoteId, editing?.id ?? null, form));
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
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
