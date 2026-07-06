"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2, CircleDollarSign } from "lucide-react";
import { addPayment, markPaymentPaid, deletePayment } from "../actions";

export interface PaymentItem {
  id: string;
  direction: string;
  counterpart: string | null;
  name: string;
  amount: number | null;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: number | null;
  note: string | null;
}

function vnd(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("vi-VN") + " ₫";
}
function d(iso: string | null): string {
  if (!iso) return "—";
  const x = new Date(iso);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

function StatusChip({ p }: { p: PaymentItem }) {
  if (p.paidDate) {
    return (
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
        {p.direction === "THU" ? "Đã thu" : "Đã trả"} {d(p.paidDate)}
      </span>
    );
  }
  if (p.dueDate && new Date(p.dueDate).getTime() < Date.now()) {
    const days = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        quá hạn {days} ngày
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
      chờ {p.direction === "THU" ? "thu" : "trả"}
    </span>
  );
}

function Section({
  title,
  direction,
  items,
  projectId,
  canEdit,
  onError,
  pending,
  startTransition,
  counterpartPlaceholder,
}: {
  title: string;
  direction: "THU" | "CHI";
  items: PaymentItem[];
  projectId: string;
  canEdit: boolean;
  onError: (e: string | null) => void;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  counterpartPlaceholder: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const totalPlan = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPaid = items.reduce((s, i) => s + (i.paidAmount ?? 0), 0);

  const submit = (form: FormData) => {
    onError(null);
    form.set("direction", direction);
    startTransition(async () => {
      const res = await addPayment(projectId, form);
      if (!res.ok) onError(res.error);
      else formRef.current?.reset();
    });
  };

  const markPaid = (p: PaymentItem) => {
    const date = window.prompt("Ngày thực " + (direction === "THU" ? "thu" : "trả") + " (YYYY-MM-DD, bỏ trống = hôm nay):") ?? "";
    const amt = window.prompt("Số tiền thực tế (bỏ trống = theo kế hoạch):") ?? "";
    startTransition(async () => {
      const res = await markPaymentPaid(p.id, projectId, date.trim(), amt.trim());
      if (!res.ok) onError(res.error);
    });
  };

  const remove = (p: PaymentItem) => {
    if (!confirm("Xóa đợt thanh toán này?")) return;
    startTransition(async () => {
      const res = await deletePayment(p.id, projectId);
      if (!res.ok) onError(res.error);
    });
  };

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <span className={`text-sm font-semibold ${direction === "THU" ? "text-blue-700" : "text-amber-700"}`}>
          {title}
        </span>
        <span className="text-xs text-slate-500">
          Kế hoạch: <b>{vnd(totalPlan)}</b> · Thực tế: <b>{vnd(totalPaid)}</b> · Còn lại:{" "}
          <b className={totalPlan - totalPaid > 0 ? "text-red-600" : "text-green-600"}>
            {vnd(Math.max(0, totalPlan - totalPaid))}
          </b>
        </span>
      </div>

      <div className="divide-y divide-slate-50">
        {items.length === 0 && <p className="px-3 py-3 text-sm text-slate-300">Chưa có đợt nào</p>}
        {items.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{p.name}</span>
                <StatusChip p={p} />
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {vnd(p.amount)}
                {p.paidAmount != null && p.paidAmount !== p.amount ? ` (thực: ${vnd(p.paidAmount)})` : ""}
                {p.dueDate ? ` · hạn ${d(p.dueDate)}` : ""}
                {p.counterpart ? ` · ${p.counterpart}` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1.5">
                {!p.paidDate && (
                  <button
                    onClick={() => markPaid(p)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    <CircleDollarSign className="h-3.5 w-3.5" />
                    {direction === "THU" ? "Đã thu" : "Đã trả"}
                  </button>
                )}
                <button
                  onClick={() => remove(p)}
                  className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  title="Xóa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form ref={formRef} action={submit} className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/60 p-2 sm:grid-cols-5">
          <input name="name" required placeholder="Tên đợt (Tạm ứng...)" className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          <input name="amount" inputMode="numeric" placeholder="Số tiền (₫)" className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          <input name="dueDate" type="date" className="rounded-md border border-slate-200 px-2 py-1 text-xs" title="Hạn" />
          <input name="counterpart" placeholder={counterpartPlaceholder} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
          <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "..." : "+ Thêm đợt"}
          </button>
        </form>
      )}
    </div>
  );
}

export function ProjectPayments({
  projectId,
  payments,
  canEdit,
}: {
  projectId: string;
  payments: PaymentItem[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="THU — từ Chủ đầu tư"
          direction="THU"
          items={payments.filter((p) => p.direction === "THU")}
          projectId={projectId}
          canEdit={canEdit}
          onError={setError}
          pending={pending}
          startTransition={startTransition}
          counterpartPlaceholder="Tên CĐT (tùy chọn)"
        />
        <Section
          title="CHI — cho NCC / thầu phụ"
          direction="CHI"
          items={payments.filter((p) => p.direction === "CHI")}
          projectId={projectId}
          canEdit={canEdit}
          onError={setError}
          pending={pending}
          startTransition={startTransition}
          counterpartPlaceholder="Tên NCC (tùy chọn)"
        />
      </div>
    </div>
  );
}
