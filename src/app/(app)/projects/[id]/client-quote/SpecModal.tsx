"use client";

import { useState } from "react";
import { Input, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { useActionForm } from "@/components/ui/useActionForm";
import { QUOTE_SPEC_GROUP, VAT_TU_TAG, VAT_TU_TAG_MAP } from "@/lib/constants";
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

  // Bốn giá trị này quyết định dòng in ra trông thế nào và có được in hay không, nên
  // giữ ở state để khối xem trước bên dưới luôn nói đúng.
  const [nhom, setNhom] = useState(editing?.groupCode ?? state.defaultGroup);
  const [tag, setTag] = useState(editing?.tag ?? "");
  const [ten, setTen] = useState(editing?.name ?? "");
  const [thongSo, setThongSo] = useState(editing?.spec ?? "");
  const [xuatXu, setXuatXu] = useState(editing?.origin ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveSpec(chu, quoteId, editing?.id ?? null, form));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa vật liệu" : "Thêm vật liệu"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* ---------- Dòng này in ở đâu, và khi nào ---------- */}
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">
            In ở đâu trên bản báo giá
          </legend>
          <input type="hidden" name="groupCode" value={nhom} />
          <input type="hidden" name="tag" value={tag} />

          <div>
            <p className="mb-1.5 text-xs text-slate-500">Nhóm</p>
            <div className="flex flex-wrap gap-1.5">
              {QUOTE_SPEC_GROUP.map((g) => (
                <Chip key={g.value} chon={nhom === g.value} onClick={() => setNhom(g.value)}>
                  {g.value}. {g.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-slate-500">Chỉ in khi báo giá có hạng mục dùng</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip chon={tag === ""} onClick={() => setTag("")}>
                Dùng chung — luôn in
              </Chip>
              {VAT_TU_TAG.map((t) => (
                <Chip key={t.value} chon={tag === t.value} onClick={() => setTag(t.value)}>
                  {t.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Báo giá không bán thưng vách thì không in dòng tôn thưng. Để “Dùng chung”
              cho thứ công trình nào cũng có: que hàn, sơn, bulong, keo vít.
            </p>
          </div>
        </fieldset>

        {/* ---------- Nội dung ba cột của bảng ---------- */}
        <div className="space-y-3">
          <Field label="Nội dung *">
            <Input
              name="name"
              value={ten}
              onChange={(e) => setTen(e.target.value)}
              required
              autoFocus
              placeholder="Thép tấm, thép hình"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Thông số kỹ thuật">
              <Input
                name="spec"
                value={thongSo}
                onChange={(e) => setThongSo(e.target.value)}
                placeholder="fy = 2.450 kG/cm2"
              />
            </Field>
            <Field label="Ghi chú và xuất xứ">
              <Input
                name="origin"
                value={xuatXu}
                onChange={(e) => setXuatXu(e.target.value)}
                placeholder="Q235 hoặc tương đương"
              />
            </Field>
          </div>
        </div>

        {/* ---------- Xem trước đúng ba ô sẽ in ---------- */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Dòng sẽ in ra
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-1 font-normal">Nội dung</th>
                  <th className="pb-1 font-normal">Thông số kỹ thuật</th>
                  <th className="pb-1 font-normal">Ghi chú và xuất xứ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="py-1.5 pr-3 text-slate-900">{ten.trim() || "—"}</td>
                  <td className="py-1.5 pr-3 italic text-slate-600">{thongSo.trim() || "—"}</td>
                  <td className="py-1.5 italic text-slate-600">{xuatXu.trim() || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Vào mục <strong>{nhom}</strong>.{" "}
            {tag
              ? `Chỉ in khi báo giá có hạng mục gắn “${VAT_TU_TAG_MAP[tag]?.label ?? tag}”.`
              : "Luôn in, không phụ thuộc hạng mục nào."}
          </p>
        </div>

        <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
          <input
            type="checkbox"
            name="inDescription"
            defaultChecked={editing?.inDescription ?? false}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Nhắc lại dòng này dưới tên hạng mục
            <span className="mt-0.5 block text-xs text-slate-400">
              Bảng vật liệu đã kể đủ rồi. Chỉ bật cho thứ khách cần thấy ngay ở hạng mục —
              thường là dòng tôn. Bật hết thì mô tả dài gấp ba báo giá thật.
            </span>
          </span>
        </label>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
