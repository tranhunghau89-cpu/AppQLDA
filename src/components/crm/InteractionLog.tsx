"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { CUSTOMER_CONTACT_KIND, CUSTOMER_CONTACT_KIND_MAP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { saveContact, deleteContact } from "@/app/(app)/customers/actions";

export interface NoteView {
  id: string;
  kind: string;
  contactDate: string; // ISO
  content: string;
  authorName: string | null;
  nextFollowUpDate: string | null; // ISO
  /** Nhãn báo giá đi kèm — chỉ dùng ở trang CĐT, nơi trộn nhật ký của nhiều báo giá. */
  quoteLabel?: string | null;
}

const ngayInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/**
 * Nhật ký trao đổi với chủ đầu tư.
 *
 * Dùng ở HAI nơi với cùng một hình dạng: trang Chủ đầu tư (toàn bộ lịch sử của một
 * CĐT) và dưới mỗi báo giá gửi khách (chỉ những lần trao đổi về báo giá đó). Gắn
 * `clientQuoteId` thì ghi chép mới tự thuộc về báo giá đó.
 *
 * Người gọi phải tự kiểm quyền xem (`can(role, "customer", "view")`) trước khi dựng —
 * vai Vật tư không có khóa `customer` nên không được thấy khối này.
 */
export function InteractionLog({
  customerId,
  clientQuoteId = null,
  notes,
  canEdit,
  trong = false,
}: {
  customerId: string;
  clientQuoteId?: string | null;
  notes: NoteView[];
  canEdit: boolean;
  /** true = nhúng trong một khối đã có khung, bỏ bớt viền cho đỡ rối. */
  trong?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [moForm, setMoForm] = useState(false);
  const [dangSua, setDangSua] = useState<NoteView | null>(null);
  const [error, setError] = useState<string | null>(null);

  function dong() {
    setMoForm(false);
    setDangSua(null);
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveContact(customerId, dangSua?.id ?? null, form);
      if (!res.ok) setError(res.error);
      else {
        dong();
        router.refresh();
      }
    });
  }

  async function onDelete(n: NoteView) {
    if (!(await confirm("Xóa ghi chép này khỏi nhật ký trao đổi?"))) return;
    start(async () => {
      const res = await deleteContact(n.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const dangMo = moForm || dangSua !== null;

  return (
    <div className={trong ? "space-y-3" : "space-y-3 rounded-xl border border-slate-200 bg-white p-4"}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">
          Nhật ký trao đổi ({notes.length})
        </span>
        {canEdit && !dangMo && (
          <Button size="sm" variant="secondary" onClick={() => setMoForm(true)}>
            <Plus className="h-4 w-4" /> Ghi trao đổi
          </Button>
        )}
      </div>

      {dangMo && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {clientQuoteId && <input type="hidden" name="clientQuoteId" value={clientQuoteId} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Hình thức">
              <Select name="kind" defaultValue={dangSua?.kind ?? "GOI"}>
                {CUSTOMER_CONTACT_KIND.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ngày liên hệ">
              <Input
                name="contactDate"
                type="date"
                defaultValue={
                  dangSua
                    ? ngayInput(dangSua.contactDate)
                    : new Date().toISOString().slice(0, 10)
                }
              />
            </Field>
            <Field label="Hẹn liên hệ lại">
              <Input
                name="nextFollowUpDate"
                type="date"
                defaultValue={ngayInput(dangSua?.nextFollowUpDate ?? null)}
              />
            </Field>
          </div>
          <Field label="Nội dung trao đổi *">
            <Textarea name="content" rows={3} defaultValue={dangSua?.content ?? ""} required />
          </Field>
          <p className="text-xs text-slate-400">
            Ngày hẹn liên hệ lại sẽ xuất hiện trong bản tin nhắc việc hằng ngày, kèm
            báo giá tương ứng.
          </p>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={dong}>
              <X className="h-3.5 w-3.5" /> Hủy
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      )}

      {notes.length === 0 && !dangMo && (
        <p className="text-sm text-slate-400">Chưa ghi lần trao đổi nào.</p>
      )}

      <ul className="space-y-2">
        {notes.map((n) => {
          const k = CUSTOMER_CONTACT_KIND_MAP[n.kind];
          return (
            <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge tone={k?.tone ?? "slate"}>{k?.label ?? n.kind}</Badge>
                <span>{formatDate(n.contactDate)}</span>
                {n.authorName && <span>· {n.authorName}</span>}
                {n.quoteLabel && <span>· {n.quoteLabel}</span>}
                {n.nextFollowUpDate && (
                  <span className="font-medium text-amber-700">
                    · hẹn liên hệ lại {formatDate(n.nextFollowUpDate)}
                  </span>
                )}
                {canEdit && (
                  <span className="ml-auto flex gap-1">
                    <button
                      onClick={() => {
                        setDangSua(n);
                        setMoForm(false);
                        setError(null);
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700"
                      title="Sửa"
                      aria-label="Sửa ghi chép"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(n)}
                      className="p-0.5 text-red-500 hover:text-red-700"
                      title="Xóa"
                      aria-label="Xóa ghi chép"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{n.content}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
