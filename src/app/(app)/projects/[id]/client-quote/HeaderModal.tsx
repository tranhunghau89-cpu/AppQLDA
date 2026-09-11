"use client";

import { useState } from "react";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { ModalActions } from "../quote/ModalActions";
import { saveClientQuote } from "./actions";
import { TemplatePicker } from "./TemplatePicker";
import type { TemplateOption } from "@/lib/quoteTemplatePick";
import type { ClientQuoteView, CustomerOption } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

/** Giá trị gợi ý khi lập báo giá mới — lấy từ dự án và người đang đăng nhập. */
export interface GoiY {
  customerId: string | null;
  recipient: string | null;
  customerPhone: string | null;
  location: string | null;
  salesName: string | null;
  salesEmail: string | null;
}

/** Hôm nay dạng YYYY-MM-DD theo giờ máy — `toISOString` là giờ UTC, lệch ngày. */
function homNay(): string {
  const d = new Date();
  const hai = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/**
 * Khối gập, có tóm tắt giá trị ngay trên nhãn.
 *
 * Mở sẵn hay không thì vẫn nằm trong DOM, nên form vẫn gửi đủ mọi ô — gập chỉ là
 * chuyện nhìn, không phải chuyện dữ liệu.
 */
function Khoi({
  nhan,
  tomTat,
  moSan,
  children,
}: {
  nhan: string;
  tomTat: string;
  moSan?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={moSan}
      className="rounded-lg border border-slate-200 [&[open]>summary]:border-b [&[open]>summary]:border-slate-100"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {nhan}
        <span className="text-xs font-normal text-slate-400">{tomTat}</span>
      </summary>
      <div className="space-y-3 p-3">{children}</div>
    </details>
  );
}

export function HeaderModal({
  chu,
  editing,
  customers,
  goiY,
  templates,
  templateGoiY,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  editing: ClientQuoteView | null;
  customers: CustomerOption[];
  goiY: GoiY;
  templates: TemplateOption[];
  templateGoiY: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { error, pending, run } = useActionForm(onDone);
  // Chọn CĐT thì tự điền "Kính gửi" và SĐT — nhưng vẫn cho sửa tay, vì bản in phải
  // chụp lại tên lúc lập chứ không đổi theo khi CĐT đổi tên sau này.
  const [customerId, setCustomerId] = useState(editing?.customerId ?? goiY.customerId ?? "");
  const [recipient, setRecipient] = useState(editing?.recipient ?? goiY.recipient ?? "");
  const [phone, setPhone] = useState(editing?.customerPhone ?? goiY.customerPhone ?? "");

  // Bốn số này hiện ngay trên nhãn khối gập, nên phải là state — để nhãn không nói
  // một đằng còn ô bên trong một nẻo sau khi người dùng sửa rồi gập lại.
  const [vat, setVat] = useState(String(editing?.vatPercent ?? 10));
  const [hieuLuc, setHieuLuc] = useState(String(editing?.validDays ?? 7));
  const [baoHanh, setBaoHanh] = useState(String(editing?.warrantyMonths ?? 12));
  const [baoTri, setBaoTri] = useState(String(editing?.maintenanceMonths ?? 120));

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
    run(() => saveClientQuote(chu, editing?.id ?? null, form));
  }

  const tomTatDieuKhoan = [
    `VAT ${vat || 0}%`,
    `hiệu lực ${hieuLuc || 0} ngày`,
    `bảo hành ${baoHanh || 0} tháng`,
    `bảo trì ${baoTri || 0} tháng`,
  ].join(" · ");

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Sửa báo giá gửi khách" : "Lập báo giá gửi khách"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Mẫu đứng ĐẦU vì nó quyết định gần hết phần còn lại: bảng vật liệu, tiến độ,
            điều khoản, các đoạn chữ. Chọn xong thì hai khối gập bên dưới thường không
            cần động tới. Chỉ có nghĩa lúc lập mới — xem TemplatePicker. */}
        {!editing && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <TemplatePicker templates={templates} goiY={templateGoiY} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Tiêu đề *">
              <Input
                name="title"
                defaultValue={editing?.title ?? ""}
                required
                placeholder="Báo giá nhà xưởng K6L120"
              />
            </Field>
          </div>
          <Field label="Số báo giá">
            <Input name="quoteNo" defaultValue={editing?.quoteNo ?? ""} placeholder="BG-2026-014" />
          </Field>
          <Field label="Ngày báo giá">
            {/* Mặc định hôm nay khi lập mới — ô ngày của trình duyệt hiển thị theo
                định dạng máy, gõ tay vào đó là chỗ dễ nhầm tháng với ngày nhất. */}
            <Input
              name="quoteDate"
              type="date"
              defaultValue={editing?.quoteDate ? editing.quoteDate.slice(0, 10) : homNay()}
            />
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-500">
            Bên nhận — in ở đầu trang 1
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Kính gửi">
                <Input
                  name="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Công ty CP ABC"
                />
              </Field>
            </div>
            <Field label="SĐT">
              <Input
                name="customerPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Địa điểm">
              <Input name="location" defaultValue={editing?.location ?? goiY.location ?? ""} />
            </Field>
            <Field label="Hạng mục">
              <Input name="scope" defaultValue={editing?.scope ?? "Kết cấu thép và bao che"} />
            </Field>
          </div>
          <Field label="Gắn với chủ đầu tư (không bắt buộc)">
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
            <p className="mt-1 text-xs text-slate-400">
              Chọn để điền nhanh &ldquo;Kính gửi&rdquo; và SĐT. Khách chưa ký hợp đồng thì
              để trống — cứ gõ thẳng tên vào ô trên.
            </p>
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
          <legend className="px-1 text-xs font-semibold text-slate-500">
            Người phụ trách — khách gọi lại số này
          </legend>
          <Field label="Họ và tên">
            <Input name="salesName" defaultValue={editing?.salesName ?? goiY.salesName ?? ""} />
          </Field>
          <Field label="SĐT">
            <Input name="salesPhone" defaultValue={editing?.salesPhone ?? ""} />
          </Field>
          {/* Email dài hơn hẳn hai ô kia — chia đều là bị cắt mất đuôi. */}
          <div className="sm:col-span-2">
            <Field label="Email">
              <Input
                name="salesEmail"
                type="email"
                defaultValue={editing?.salesEmail ?? goiY.salesEmail ?? ""}
              />
            </Field>
          </div>
        </fieldset>

        <Khoi nhan="Điều khoản & tải trọng" tomTat={tomTatDieuKhoan} moSan={Boolean(editing)}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="VAT (%)">
              <Input
                name="vatPercent"
                type="number"
                step="any"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </Field>
            <Field label="Hiệu lực (ngày)">
              <Input
                name="validDays"
                type="number"
                value={hieuLuc}
                onChange={(e) => setHieuLuc(e.target.value)}
              />
            </Field>
            <Field label="Bảo hành (tháng)">
              <Input
                name="warrantyMonths"
                type="number"
                value={baoHanh}
                onChange={(e) => setBaoHanh(e.target.value)}
              />
            </Field>
            <Field label="Bảo trì (tháng)">
              <Input
                name="maintenanceMonths"
                type="number"
                value={baoTri}
                onChange={(e) => setBaoTri(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Hoạt tải mái (kg/m²)">
              <Input
                name="loadRoof"
                type="number"
                step="any"
                defaultValue={editing?.loadRoof ?? 10}
              />
            </Field>
            <Field label="Tải treo (kg/m²)">
              <Input
                name="loadHanging"
                type="number"
                step="any"
                defaultValue={editing?.loadHanging ?? 30}
              />
            </Field>
            <Field label="Tải sàn (kg/m²)">
              <Input
                name="loadFloor"
                type="number"
                step="any"
                defaultValue={editing?.loadFloor ?? 150}
              />
            </Field>
          </div>
        </Khoi>

        <Khoi
          nhan="Đoạn chữ in ra"
          tomTat="mô tả hạng mục, lời chào, 3 ghi chú, lời kết"
          moSan={Boolean(editing)}
        >
          <Field label="Mô tả chung của hạng mục (in dưới tên mọi đầu việc)">
            <Textarea
              name="lineDetail"
              rows={3}
              defaultValue={editing?.lineDetail ?? ""}
              placeholder={
                "- Gia công sản xuất theo bản vẽ thiết kế.\n" +
                "- Tôn mái là tôn Đông Á độ dày 0,45 mm mạ màu, 5 sóng công nghiệp."
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Mỗi dòng là một gạch đầu dòng. Hạng mục nào cần mô tả khác thì điền riêng ở
              dòng đó để đè lên.
            </p>
          </Field>
          <Field label="Lời mở đầu">
            <Textarea name="greeting" rows={3} defaultValue={editing?.greeting ?? ""} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Ghi chú màu sắc">
              <Textarea name="colorNote" rows={3} defaultValue={editing?.colorNote ?? ""} />
            </Field>
            <Field label="Ghi chú khối lượng tạm tính">
              <Textarea name="volumeNote" rows={3} defaultValue={editing?.volumeNote ?? ""} />
            </Field>
            <Field label="Ghi chú loại trừ">
              <Textarea name="excludeNote" rows={3} defaultValue={editing?.excludeNote ?? ""} />
            </Field>
          </div>
          <Field label="Lời kết">
            <Textarea name="closing" rows={2} defaultValue={editing?.closing ?? ""} />
          </Field>
          {!editing && (
            <p className="text-xs text-slate-400">
              Để trống hết cũng được — mẫu đã chọn ở trên sẽ rót sẵn.
            </p>
          )}
        </Khoi>

        <Field label="Ghi chú nội bộ (không in ra)">
          <Textarea name="note" rows={2} defaultValue={editing?.note ?? ""} />
        </Field>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
