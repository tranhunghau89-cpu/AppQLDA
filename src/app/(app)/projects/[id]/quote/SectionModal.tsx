"use client";

import { useState } from "react";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "./ModalActions";
import { saveSection } from "./actions";
import type { SectionView } from "./types";

export interface SectionModalState {
  quoteId: string;
  /** Các phần gốc để chọn làm cha cho một mục con. */
  phanOptions: SectionView[];
  editing: SectionView | null;
  defaultKind: "PHAN" | "SUB";
  defaultParent: string;
}

export function SectionModal({
  projectId,
  state,
  onClose,
  onDone,
}: {
  projectId: string;
  state: SectionModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, phanOptions, quoteId } = state;
  const [kind, setKind] = useState<"PHAN" | "SUB">(
    editing ? (editing.kind as "PHAN" | "SUB") : state.defaultKind
  );
  const [parent, setParent] = useState(editing?.parentId ?? state.defaultParent);
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveSection(projectId, quoteId, editing?.id ?? null, form));
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Sửa phần/mục" : "Thêm phần/mục"}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Loại *">
          <Select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "PHAN" | "SUB")}
          >
            <option value="PHAN">Phần (A, B, C…)</option>
            <option value="SUB">Mục con (I, II…)</option>
          </Select>
        </Field>
        {kind === "SUB" && (
          <Field label="Thuộc phần *">
            <Select name="parentId" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">— Chọn phần —</option>
              {phanOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Mã (A / I) *">
            <Input name="code" defaultValue={editing?.code ?? ""} required />
          </Field>
          <Field label="Diện tích (m²)">
            <Input name="area" type="number" step="any" defaultValue={editing?.area ?? ""} />
          </Field>
        </div>
        <Field label="Tên phần/mục *">
          <Input name="name" defaultValue={editing?.name ?? ""} required />
        </Field>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
