"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { sumStageDays, validatePaymentPercents } from "@/lib/clientQuote";
import { ModalActions } from "../quote/ModalActions";
import { saveTerms } from "./actions";
import type { PaymentView, StageView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

export interface TermsModalState {
  quoteId: string;
  stages: StageView[];
  payments: PaymentView[];
}

interface StageRow {
  name: string;
  days: string;
}
interface PaymentRow {
  label: string;
  percent: string;
  basis: string;
  note: string;
}

const soHoacNull = (v: string) => (v === "" ? null : Number(v));

export function TermsModal({
  chu,
  state,
  onClose,
  onDone,
}: {
  chu: ChuBaoGia;
  state: TermsModalState;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stages, setStages] = useState<StageRow[]>(
    state.stages.map((s) => ({ name: s.name, days: s.days != null ? String(s.days) : "" }))
  );
  const [payments, setPayments] = useState<PaymentRow[]>(
    state.payments.map((p) => ({
      label: p.label,
      percent: p.percent != null ? String(p.percent) : "",
      basis: p.basis ?? "",
      note: p.note ?? "",
    }))
  );
  const { error, pending, run } = useActionForm(onDone);

  // Cùng một hàm kiểm mà máy chủ dùng — hiện tổng ngay khi gõ thay vì bắt bấm Lưu
  // mới biết là thiếu 5%.
  const tongNgay = sumStageDays(stages.map((s) => ({ days: soHoacNull(s.days) })));
  const check = validatePaymentPercents(payments.map((p) => ({ percent: soHoacNull(p.percent) })));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    form.set("stages", JSON.stringify(stages));
    form.set("payments", JSON.stringify(payments));
    run(() => saveTerms(chu, state.quoteId, form));
  }

  return (
    <Modal open onClose={onClose} size="lg" title="Tiến độ thi công & thanh toán">
      <form onSubmit={onSubmit} className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Tiến độ thi công</h4>
            <span className="text-sm text-slate-500">Tổng {tongNgay} ngày</span>
          </div>
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Tên chặng ${i + 1}`}
                className="flex-1"
                value={s.name}
                onChange={(e) =>
                  setStages((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                }
                placeholder="Gia công cấu kiện"
              />
              <Input
                aria-label={`Số ngày chặng ${i + 1}`}
                className="w-24"
                type="number"
                value={s.days}
                onChange={(e) =>
                  setStages((p) => p.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)))
                }
              />
              <span className="w-10 text-sm text-slate-400">ngày</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                aria-label={`Xóa chặng ${i + 1}`}
                onClick={() => setStages((p) => p.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStages((p) => [...p, { name: "", days: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm chặng
          </Button>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Tiến độ thanh toán</h4>
            <span
              className={`text-sm font-medium ${check.ok ? "text-green-600" : "text-red-600"}`}
            >
              Tổng {Math.round(check.sum * 100) / 100}%
            </span>
          </div>
          {payments.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Đợt ${i + 1}`}
                className="min-w-[10rem] flex-1"
                value={p.label}
                onChange={(e) =>
                  setPayments((q) =>
                    q.map((r, j) => (j === i ? { ...r, label: e.target.value } : r))
                  )
                }
                placeholder="Sau khi kí hợp đồng"
              />
              <Input
                aria-label={`Tỷ lệ đợt ${i + 1}`}
                className="w-20"
                type="number"
                step="any"
                value={p.percent}
                onChange={(e) =>
                  setPayments((q) =>
                    q.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r))
                  )
                }
              />
              <span className="text-sm text-slate-400">%</span>
              <Input
                aria-label={`Căn cứ đợt ${i + 1}`}
                className="w-28"
                value={p.basis}
                onChange={(e) =>
                  setPayments((q) =>
                    q.map((r, j) => (j === i ? { ...r, basis: e.target.value } : r))
                  )
                }
                placeholder="GTHĐ"
              />
              <Input
                aria-label={`Ghi chú đợt ${i + 1}`}
                className="min-w-[8rem] flex-1"
                value={p.note}
                onChange={(e) =>
                  setPayments((q) => q.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))
                }
                placeholder="kí hợp đồng"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                aria-label={`Xóa đợt ${i + 1}`}
                onClick={() => setPayments((q) => q.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPayments((q) => [...q, { label: "", percent: "", basis: "GTHĐ", note: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Thêm đợt
          </Button>
          {!check.ok && <p className="text-sm text-red-600">{check.error}</p>}
        </section>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
