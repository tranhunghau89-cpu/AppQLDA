"use client";

import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../quote/ModalActions";
import { TemplatePicker } from "./TemplatePicker";
import { apBoHangMuc } from "./actions";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/** Chọn bộ hạng mục + các phần, thêm hết vào báo giá đang mở trong một lần. */
export function ApBoModal({
  chu,
  quoteId,
  templates,
  goiY,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  quoteId: string;
  templates: TemplateOption[];
  goiY: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const templateId = String(form.get("templateId") ?? "");
    run(async () => {
      if (!templateId) return { ok: false, error: "Chọn một bộ hạng mục." };
      return apBoHangMuc(chu, quoteId, templateId, form.getAll("phanChon").map(String));
    });
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Áp bộ hạng mục">
      <form onSubmit={onSubmit} className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có bộ hạng mục nào — tạo trong Thư viện đơn giá → Bộ hạng mục.
          </p>
        ) : (
          <TemplatePicker templates={templates} goiY={goiY ?? templates[0].id} />
        )}
        <p className="text-xs text-slate-500">
          Các hạng mục được thêm vào cuối bảng, giữ nguyên những dòng đang có.
        </p>
        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
