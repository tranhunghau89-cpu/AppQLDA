"use client";

import { useState } from "react";
import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";
import { useActionForm } from "@/components/ui/useActionForm";
import { VAT_TU_TAG } from "@/lib/constants";
import { lineAmount } from "@/lib/clientQuote";
import { formatNumber, formatQty, formatVND } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ModalActions } from "../quote/ModalActions";
import { saveLine } from "./actions";
import type { LineView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

export interface LineModalState {
  quoteId: string;
  editing: LineView | null;
}

/** Chuỗi trong ô số -> số, hoặc null khi để trống / gõ dở. */
function so(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Khối gập có tóm tắt ngay trên nhãn — cùng khuôn với hộp thoại lập báo giá. */
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

export function LineModal({
  chu,
  state,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  state: LineModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const { editing, quoteId } = state;
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const { error, pending, run } = useActionForm(onDone);

  const [unit, setUnit] = useState(editing?.unit ?? "m2");
  const [qty, setQty] = useState(editing?.qty != null ? String(editing.qty) : "");
  const [donGia, setDonGia] = useState(editing?.unitPrice != null ? String(editing.unitPrice) : "");
  // Dòng khoán: thành tiền không suy từ khối lượng × đơn giá mà chốt cứng một số.
  // Hiếm dùng nên mặc định tắt; đang sửa một dòng đã chốt thì bật sẵn.
  const [chotCung, setChotCung] = useState(editing?.amount != null);
  const [amount, setAmount] = useState(editing?.amount != null ? String(editing.amount) : "");

  const sQty = so(qty);
  const sDonGia = so(donGia);
  const sAmount = so(amount);
  // Dùng ĐÚNG hàm mà bản in và mọi phép cộng dùng — xem trước mà tính bằng công thức
  // khác là thà đừng xem.
  const thanhTien = lineAmount({
    qty: sQty,
    unitPrice: sDonGia,
    amount: chotCung ? sAmount : null,
  });
  const duSo = chotCung ? sAmount != null : sQty != null && sDonGia != null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveLine(chu, quoteId, editing?.id ?? null, form));
  }

  const tenPhan = `${editing?.partCode ?? "I"} · ${editing?.partName ?? "Phần kết cấu thép"}`;
  const tenVatTu = tags
    .map((v) => VAT_TU_TAG.find((t) => t.value === v)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? "Sửa hạng mục" : "Thêm hạng mục"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nội dung công việc *">
          <Input
            name="name"
            defaultValue={editing?.name ?? ""}
            required
            placeholder="Khung thép và tôn phần mái"
          />
        </Field>

        <Field label="Vật tư dùng cho hạng mục này">
          {/* Bấm cả ô chứ không phải bấm đúng ô vuông nhỏ — nhanh hơn hẳn, và nhìn là
              biết cái nào đang chọn mà không phải soi dấu tích. */}
          <div className="flex flex-wrap gap-1.5">
            {VAT_TU_TAG.map((t) => {
              const chon = tags.includes(t.value);
              return (
                <Chip
                  key={t.value}
                  chon={chon}
                  onClick={() =>
                    setTags((p) =>
                      p.includes(t.value) ? p.filter((x) => x !== t.value) : [...p, t.value]
                    )
                  }
                >
                  {t.label}
                </Chip>
              );
            })}
          </div>
          {/* Gửi lên dạng chuỗi ngăn bằng dấu phẩy — cả form đi bằng FormData. */}
          <input type="hidden" name="tags" value={tags.join(",")} />
          <p className="mt-1.5 text-xs text-slate-400">
            Quyết định bảng “Vật liệu &amp; thông số kỹ thuật” in ra những dòng nào, và
            sinh luôn phần mô tả dưới tên hạng mục.
          </p>
        </Field>

        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          {/* Cố ý KHÔNG khóa ba ô này khi chốt cứng: dòng khoán vẫn in ra khối lượng và
              đơn giá ("6 cái × 184.000"), chỉ có thành tiền là không suy từ chúng. Mà ô
              disabled thì FormData bỏ qua — khóa ở đây là xóa mất dữ liệu. */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Đơn vị">
              <Input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
            <Field label="Khối lượng">
              <Input
                name="qty"
                type="number"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label="Đơn giá">
              <Input
                name="unitPrice"
                type="number"
                step="any"
                value={donGia}
                onChange={(e) => setDonGia(e.target.value)}
              />
            </Field>
          </div>

          {/* Thành tiền hiện ngay khi gõ. Đây là con số đi thẳng vào văn bản gửi khách,
              không có lý do gì bắt người lập phải lưu rồi mới thấy. */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-500">
              {sQty != null && sDonGia != null ? (
                <span className={chotCung ? "line-through decoration-slate-400" : ""}>
                  {formatQty(sQty)} {unit || ""} × {formatNumber(sDonGia)} ₫
                </span>
              ) : chotCung ? (
                "Thành tiền chốt cứng"
              ) : (
                "Điền khối lượng và đơn giá để thấy thành tiền"
              )}
              {chotCung && sQty != null && sDonGia != null && (
                <span className="ml-2 text-xs">đã bị đè</span>
              )}
            </span>
            <span
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                duSo ? "text-slate-900" : "text-slate-300"
              )}
            >
              {duSo ? formatVND(thanhTien) : "—"}
            </span>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={chotCung}
              onChange={(e) => setChotCung(e.target.checked)}
            />
            <span>
              Chốt cứng thành tiền — dòng khoán, vd “Cửa đẩy chớp KT 1,0×3,0 m (6 cái)”
            </span>
          </label>

          {/* Chỉ dựng ô khi thật sự dùng: tháo dấu tích là ô biến mất khỏi form, nên
              thành tiền quay về khối lượng × đơn giá thay vì giữ một số cũ. */}
          {chotCung && (
            <Field label="Thành tiền (VND)">
              <Input
                name="amount"
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </Field>
          )}
        </div>

        <Field label="Ghi chú / Quy cách">
          <Input name="note" defaultValue={editing?.note ?? ""} />
        </Field>

        <Khoi
          nhan="Xếp vào phần"
          tomTat={tenPhan}
          moSan={!editing}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Mã phần">
              <Input name="partCode" defaultValue={editing?.partCode ?? "I"} />
            </Field>
            <div className="col-span-1 sm:col-span-2">
              <Field label="Tên phần">
                <Input name="partName" defaultValue={editing?.partName ?? "Phần kết cấu thép"} />
              </Field>
            </div>
            <Field label="STT">
              <Input name="code" defaultValue={editing?.code ?? ""} placeholder="01" />
            </Field>
          </div>
          <p className="text-xs text-slate-400">
            Các dòng cùng mã phần được gom lại và cộng riêng một tổng khi in.
          </p>
        </Khoi>

        <Khoi
          nhan="Mô tả riêng của dòng này"
          tomTat={
            editing?.detail
              ? "đang có mô tả riêng"
              : tenVatTu
                ? `để trống = mô tả chung + ${tenVatTu}`
                : "để trống = mô tả chung"
          }
          moSan={Boolean(editing?.detail)}
        >
          <Textarea
            name="detail"
            rows={3}
            defaultValue={editing?.detail ?? ""}
            placeholder={
              "- Gia công sản xuất theo bản vẽ thiết kế.\n" +
              "- Tôn mái là tôn Đông Á dày 0,45 mm mạ màu, 5 sóng công nghiệp."
            }
          />
          <p className="text-xs text-slate-400">
            Mỗi dòng là một gạch đầu dòng. Điền vào đây là ĐÈ LÊN mô tả chung của báo
            giá, không phải thêm vào.
          </p>
        </Khoi>

        {editing?.sourceSectionId && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Đơn giá dòng này được suy ra từ báo giá chi tiết. Sửa tay ở đây sẽ đánh dấu là
            “đã đè giá”, và lần “Tính lại đơn giá” sau sẽ bỏ qua dòng này.
          </p>
        )}

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
