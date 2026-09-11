"use client";

import { useState } from "react";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../quote/ModalActions";
import { saveClientQuote } from "./actions";
import type { ClientQuoteView, CustomerOption } from "./types";

/** Giá trị gợi ý khi lập báo giá mới — lấy từ dự án và người đang đăng nhập. */
export interface GoiY {
  customerId: string | null;
  recipient: string | null;
  customerPhone: string | null;
  location: string | null;
  salesName: string | null;
  salesEmail: string | null;
}

export function HeaderModal({
  projectId,
  editing,
  customers,
  goiY,
  onClose,
  onDone,
}: {
  projectId: string;
  editing: ClientQuoteView | null;
  customers: CustomerOption[];
  goiY: GoiY;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);
  // Chọn CĐT thì tự điền "Kính gửi" và SĐT — nhưng vẫn cho sửa tay, vì bản in phải
  // chụp lại tên lúc lập chứ không đổi theo khi CĐT đổi tên sau này.
  const [customerId, setCustomerId] = useState(editing?.customerId ?? goiY.customerId ?? "");
  const [recipient, setRecipient] = useState(editing?.recipient ?? goiY.recipient ?? "");
  const [phone, setPhone] = useState(editing?.customerPhone ?? goiY.customerPhone ?? "");

  function onPickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setRecipient(c.name);
    if (c.phone) setPhone(c.phone);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveClientQuote(projectId, editing?.id ?? null, form));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa báo giá gửi khách" : "Lập báo giá gửi khách"}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Tiêu đề *">
            <Input name="title" defaultValue={editing?.title ?? ""} required />
          </Field>
          <Field label="Số báo giá">
            <Input name="quoteNo" defaultValue={editing?.quoteNo ?? ""} placeholder="BG-2026-014" />
          </Field>
          <Field label="Ngày báo giá">
            <Input
              name="quoteDate"
              type="date"
              defaultValue={editing?.quoteDate ? editing.quoteDate.slice(0, 10) : ""}
            />
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">Bên nhận</legend>
          <Field label="Chủ đầu tư">
            <Select
              name="customerId"
              value={customerId}
              onChange={(e) => onPickCustomer(e.target.value)}
            >
              <option value="">— Không gắn —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Kính gửi">
              <Input
                name="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Field>
            <Field label="SĐT">
              <Input name="customerPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Địa điểm">
              <Input name="location" defaultValue={editing?.location ?? goiY.location ?? ""} />
            </Field>
            <Field label="Hạng mục">
              <Input
                name="scope"
                defaultValue={editing?.scope ?? "Kết cấu thép và bao che"}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">Người phụ trách</legend>
          <Field label="Họ và tên">
            <Input name="salesName" defaultValue={editing?.salesName ?? goiY.salesName ?? ""} />
          </Field>
          <Field label="SĐT">
            <Input name="salesPhone" defaultValue={editing?.salesPhone ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="salesEmail" defaultValue={editing?.salesEmail ?? goiY.salesEmail ?? ""} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
          <legend className="px-1 text-xs font-semibold text-slate-500">Thuế & thời hạn</legend>
          <Field label="VAT (%)">
            <Input name="vatPercent" type="number" step="any" defaultValue={editing?.vatPercent ?? 10} />
          </Field>
          <Field label="Hiệu lực (ngày)">
            <Input name="validDays" type="number" defaultValue={editing?.validDays ?? 7} />
          </Field>
          <Field label="Bảo hành (tháng)">
            <Input name="warrantyMonths" type="number" defaultValue={editing?.warrantyMonths ?? 12} />
          </Field>
          <Field label="Bảo trì (tháng)">
            <Input
              name="maintenanceMonths"
              type="number"
              defaultValue={editing?.maintenanceMonths ?? 120}
            />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">
            Tải trọng tính toán (kg/m²)
          </legend>
          <Field label="Hoạt tải mái">
            <Input name="loadRoof" type="number" step="any" defaultValue={editing?.loadRoof ?? 10} />
          </Field>
          <Field label="Tải treo">
            <Input
              name="loadHanging"
              type="number"
              step="any"
              defaultValue={editing?.loadHanging ?? 30}
            />
          </Field>
          <Field label="Tải sàn">
            <Input name="loadFloor" type="number" step="any" defaultValue={editing?.loadFloor ?? 150} />
          </Field>
        </fieldset>

        {/* Các đoạn chữ in ra — để trống khi tạo mới thì hệ thống tự rót mẫu. */}
        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">
            Đoạn chữ in ra (lời chào, ghi chú)
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="Lời mở đầu">
              <Textarea name="greeting" rows={3} defaultValue={editing?.greeting ?? ""} />
            </Field>
            <Field label="Ghi chú màu sắc">
              <Textarea name="colorNote" rows={2} defaultValue={editing?.colorNote ?? ""} />
            </Field>
            <Field label="Ghi chú khối lượng tạm tính">
              <Textarea name="volumeNote" rows={2} defaultValue={editing?.volumeNote ?? ""} />
            </Field>
            <Field label="Ghi chú loại trừ">
              <Textarea name="excludeNote" rows={2} defaultValue={editing?.excludeNote ?? ""} />
            </Field>
            <Field label="Lời kết">
              <Textarea name="closing" rows={2} defaultValue={editing?.closing ?? ""} />
            </Field>
          </div>
        </details>

        <Field label="Ghi chú nội bộ">
          <Textarea name="note" defaultValue={editing?.note ?? ""} />
        </Field>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
