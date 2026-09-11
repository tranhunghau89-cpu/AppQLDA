"use client";

import { useState } from "react";
import { Input, Select, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { sellFromBase } from "@/lib/quote";
import { ModalActions } from "./ModalActions";
import { saveItem } from "./actions";
import type { CatalogOption, ItemView, SectionView } from "./types";

export interface ItemModalState {
  quoteId: string;
  markup: number;
  sections: SectionView[];
  editing: ItemView | null;
  /** Mục vừa được bấm thêm dòng — dùng khi thêm mới. */
  defaultSectionId: string;
}

/** Nhãn trong ô chọn mục: mục con hiện kèm mã của phần cha. */
function leafLabel(sections: SectionView[], s: SectionView): string {
  if (s.kind === "SUB") {
    const parent = sections.find((x) => x.id === s.parentId);
    return `${parent?.code ?? ""}.${s.code} — ${s.name}`;
  }
  return `${s.code} — ${s.name}`;
}

export function ItemModal({
  projectId,
  catalog,
  state,
  onClose,
  onDone,
}: {
  projectId: string;
  catalog: CatalogOption[];
  state: ItemModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, markup, sections, quoteId } = state;
  const [f, setF] = useState({
    sectionId: editing?.sectionId ?? state.defaultSectionId,
    workCode: editing?.workCode ?? "",
    name: editing?.name ?? "",
    unit: editing?.unit ?? "",
    qty: editing?.qty != null ? String(editing.qty) : "",
    baseCost: editing?.baseCost != null ? String(editing.baseCost) : "",
    sellPrice: editing?.sellPrice != null ? String(editing.sellPrice) : "",
    spec: editing?.spec ?? "",
    note: editing?.note ?? "",
  });
  const { error, pending, run } = useActionForm(onDone);

  /** Chọn Mã CV thì rót sẵn tên/đơn vị/giá gốc và tính luôn đơn giá bán theo TL. */
  function onPickCatalog(code: string) {
    if (!code) {
      setF((p) => ({ ...p, workCode: "" }));
      return;
    }
    const c = catalog.find((x) => x.code === code);
    if (!c) {
      setF((p) => ({ ...p, workCode: code }));
      return;
    }
    const base = c.baseCost ?? 0;
    setF((p) => ({
      ...p,
      workCode: code,
      name: c.name,
      unit: c.unit ?? "",
      baseCost: String(base),
      sellPrice: String(Math.round(sellFromBase(base, markup))),
    }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveItem(projectId, quoteId, editing?.id ?? null, form));
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Sửa dòng vật tư" : "Thêm dòng vật tư"}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Thuộc mục *">
          <Select
            name="sectionId"
            value={f.sectionId}
            onChange={(e) => setF((p) => ({ ...p, sectionId: e.target.value }))}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {leafLabel(sections, s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Chọn Mã CV từ bảng đơn giá">
          <Select name="workCode" value={f.workCode} onChange={(e) => onPickCatalog(e.target.value)}>
            <option value="">— Tự nhập —</option>
            {catalog.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nội dung công việc *">
          <Input
            name="name"
            value={f.name}
            onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Đơn vị">
            <Input
              name="unit"
              value={f.unit}
              onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))}
            />
          </Field>
          <Field label="Khối lượng">
            <Input
              name="qty"
              type="number"
              step="any"
              value={f.qty}
              onChange={(e) => setF((p) => ({ ...p, qty: e.target.value }))}
            />
          </Field>
          <Field label="Quy cách">
            <Input
              name="spec"
              value={f.spec}
              onChange={(e) => setF((p) => ({ ...p, spec: e.target.value }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Giá gốc">
            <Input
              name="baseCost"
              type="number"
              step="any"
              value={f.baseCost}
              onChange={(e) => {
                const v = e.target.value;
                setF((p) => ({
                  ...p,
                  baseCost: v,
                  sellPrice:
                    v === ""
                      ? p.sellPrice
                      : String(Math.round(sellFromBase(Number(v) || 0, markup))),
                }));
              }}
            />
          </Field>
          <Field label={`Đơn giá bán (TL ×${markup})`}>
            <Input
              name="sellPrice"
              type="number"
              step="any"
              value={f.sellPrice}
              onChange={(e) => setF((p) => ({ ...p, sellPrice: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Ghi chú">
          <Input
            name="note"
            value={f.note}
            onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
          />
        </Field>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
