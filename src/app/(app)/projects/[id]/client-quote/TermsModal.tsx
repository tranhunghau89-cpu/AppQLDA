"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useActionForm } from "@/components/ui/useActionForm";
import { sumStageDays, validatePaymentPercents } from "@/lib/clientQuote";
import { congDonNgay, tienCacDot } from "@/lib/clientQuoteTerms";
import { formatVND } from "@/lib/utils";
import { ModalActions } from "../quote/ModalActions";
import { saveTerms } from "./actions";
import type { PaymentView, StageView } from "./types";
import type { ChuBaoGia } from "@/lib/quoteOwner";

export interface TermsModalState {
  quoteId: string;
  stages: StageView[];
  payments: PaymentView[];
  /** Để quy phần trăm từng đợt ra tiền thật ngay khi gõ. */
  tongSauThue: number;
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

/** Nhãn cột của bảng nhập — nhỏ, xám, đứng yên trên đầu các ô. */
function Cot({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] uppercase tracking-wide text-slate-400 ${className ?? ""}`}>
      {children}
    </div>
  );
}

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

  // Cùng một hàm kiểm mà máy chủ dùng — hiện tổng ngay khi gõ thay vì bắt bấm Lưu mới
  // biết là thiếu 5%.
  const tongNgay = sumStageDays(stages.map((s) => ({ days: soHoacNull(s.days) })));
  const mocNgay = congDonNgay(stages.map((s) => ({ days: soHoacNull(s.days) })));
  const check = validatePaymentPercents(payments.map((p) => ({ percent: soHoacNull(p.percent) })));
  const tien = tienCacDot(
    state.tongSauThue,
    payments.map((p) => soHoacNull(p.percent))
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    form.set("stages", JSON.stringify(stages));
    form.set("payments", JSON.stringify(payments));
    run(() => saveTerms(chu, state.quoteId, form));
  }

  // Một dòng thanh toán có sáu ô — khổ lg thì ô "Mốc" bị đẩy xuống dòng dưới, lệch
  // hẳn khỏi nhãn cột của nó.
  return (
    <Modal open onClose={onClose} size="xl" title="Tiến độ thi công & thanh toán">
      <form onSubmit={onSubmit} className="space-y-5">
        {/* ---------- Tiến độ thi công ---------- */}
        <section className="rounded-lg border border-slate-200">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <h4 className="text-sm font-semibold text-slate-700">Tiến độ thi công</h4>
            <span className="text-sm text-slate-500">
              Tổng <strong className="text-slate-800">{tongNgay}</strong> ngày
            </span>
          </header>

          <div className="space-y-2 p-3">
            {stages.length > 0 && (
              <div className="flex items-center gap-2 pr-9">
                <Cot className="w-6">#</Cot>
                <Cot className="flex-1">Tên chặng</Cot>
                <Cot className="w-20">Số ngày</Cot>
                <Cot className="w-20 text-right">Xong ngày</Cot>
              </div>
            )}

            {stages.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-sm text-slate-400">{i + 1}</span>
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
                  className="w-20"
                  type="number"
                  value={s.days}
                  onChange={(e) =>
                    setStages((p) => p.map((r, j) => (j === i ? { ...r, days: e.target.value } : r)))
                  }
                />
                {/* Người lập nghĩ theo từng chặng, khách hỏi "bao giờ xong". */}
                <span className="w-20 text-right text-sm tabular-nums text-slate-500">
                  {mocNgay[i] ?? 0}
                </span>
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

            {stages.length === 0 && (
              <p className="py-2 text-sm text-slate-400">
                Chưa có chặng nào — bản in sẽ ghi thời gian thi công 0 ngày.
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStages((p) => [...p, { name: "", days: "" }])}
            >
              <Plus className="h-3.5 w-3.5" /> Thêm chặng
            </Button>
          </div>
        </section>

        {/* ---------- Tiến độ thanh toán ---------- */}
        <section className="rounded-lg border border-slate-200">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <h4 className="text-sm font-semibold text-slate-700">Tiến độ thanh toán</h4>
            <span className="text-sm">
              <span className={check.ok ? "text-slate-500" : "text-red-600"}>
                Tổng <strong>{Math.round(check.sum * 100) / 100}%</strong>
              </span>
              <span className="ml-2 text-slate-500">
                trên {formatVND(state.tongSauThue)} sau thuế
              </span>
            </span>
          </header>

          <div className="space-y-2 p-3">
            {payments.length > 0 && (
              <div className="hidden items-center gap-2 pr-9 sm:flex">
                <Cot className="w-6">#</Cot>
                <Cot className="min-w-[9rem] flex-1">Đợt thanh toán</Cot>
                <Cot className="w-16">%</Cot>
                <Cot className="w-32 text-right">Số tiền</Cot>
                <Cot className="w-24">Căn cứ</Cot>
                <Cot className="min-w-[7rem] flex-1">Mốc</Cot>
              </div>
            )}

            {payments.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-sm text-slate-400">{i + 1}</span>
                <Input
                  aria-label={`Đợt ${i + 1}`}
                  className="min-w-[9rem] flex-1"
                  value={p.label}
                  onChange={(e) =>
                    setPayments((q) =>
                      q.map((r, j) => (j === i ? { ...r, label: e.target.value } : r))
                    )
                  }
                  placeholder="Đợt 1"
                />
                <Input
                  aria-label={`Tỷ lệ đợt ${i + 1}`}
                  className="w-16"
                  type="number"
                  step="any"
                  value={p.percent}
                  onChange={(e) =>
                    setPayments((q) =>
                      q.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r))
                    )
                  }
                />
                {/* Bản in chỉ có phần trăm; cột tiền này để người lập biết mình đang
                    hứa bao nhiêu, ngay lúc gõ. */}
                <span className="w-32 text-right text-sm tabular-nums text-slate-600">
                  {tien[i] != null ? formatVND(tien[i] as number) : "—"}
                </span>
                <Input
                  aria-label={`Căn cứ đợt ${i + 1}`}
                  className="w-24"
                  value={p.basis}
                  onChange={(e) =>
                    setPayments((q) =>
                      q.map((r, j) => (j === i ? { ...r, basis: e.target.value } : r))
                    )
                  }
                  placeholder="GTHĐ"
                />
                <Input
                  aria-label={`Mốc đợt ${i + 1}`}
                  className="min-w-[7rem] flex-1"
                  value={p.note}
                  onChange={(e) =>
                    setPayments((q) =>
                      q.map((r, j) => (j === i ? { ...r, note: e.target.value } : r))
                    )
                  }
                  placeholder="sau khi ký hợp đồng"
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

            {payments.length === 0 && (
              <p className="py-2 text-sm text-slate-400">
                Chưa có đợt nào. Chuyển sang “Đã gửi” sẽ bị chặn cho tới khi đủ 100%.
              </p>
            )}

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
          </div>
        </section>

        <ModalActions error={error} pending={pending} onCancel={onClose} />
      </form>
    </Modal>
  );
}
