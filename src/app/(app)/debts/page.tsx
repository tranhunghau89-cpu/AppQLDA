import { requireView } from "@/lib/auth";
import { getReceivables, getPayables } from "@/lib/debt";
import { formatVND } from "@/lib/utils";
import { ReceivableTable, PayableTable } from "./DebtTables";

export default async function DebtsPage() {
  await requireView("debt");

  const [receivables, payables] = await Promise.all([getReceivables(), getPayables()]);

  const totReceivable = receivables.reduce((s, r) => s + r.totalReceivable, 0);
  const totPayable = payables.reduce((s, r) => s + r.totalPayable, 0);
  const net = totReceivable - totPayable;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Công nợ</h1>
        <p className="text-sm text-slate-500">
          Tổng hợp công nợ phải thu (chủ đầu tư) và phải trả (nhà cung cấp) — lấy từ quyết
          toán, hợp đồng và đơn hàng.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Còn phải thu (CĐT)</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{formatVND(totReceivable)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Còn phải trả (NCC)</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{formatVND(totPayable)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Chênh lệch (thu − trả)</div>
          <div
            className={`mt-1 text-2xl font-bold ${
              net >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatVND(net)}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Phải thu — theo chủ đầu tư{" "}
          <span className="text-sm font-normal text-slate-400">
            ({receivables.length} CĐT)
          </span>
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white">
          <ReceivableTable rows={receivables} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Phải trả — theo nhà cung cấp{" "}
          <span className="text-sm font-normal text-slate-400">({payables.length} NCC)</span>
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white">
          <PayableTable rows={payables} />
        </div>
      </section>
    </div>
  );
}
