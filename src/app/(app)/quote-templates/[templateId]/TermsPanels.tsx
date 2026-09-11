"use client";

import { Panel, Cell, RowTools, Thc, TABLE_CLS, THEAD_CLS, TR_CLS, TD_CLS } from "./PanelParts";
import type { RowsApi } from "./useRows";
import type { StageRow, PaymentRow } from "./types";

/** Tiến độ thi công (ghi chú 4) — tổng số ngày in ra là tổng của bảng này. */
export function StagesPanel({ api, tongNgay }: { api: RowsApi<StageRow>; tongNgay: number }) {
  const { rows, upd, add, remove, move } = api;

  return (
    <Panel
      title="Tiến độ thi công"
      hint={`Tổng thời gian thi công in ra báo giá = ${tongNgay} ngày.`}
      count={rows.length}
      onAdd={add}
    >
      <table className={TABLE_CLS}>
        <thead className={THEAD_CLS}>
          <tr>
            <Thc>Chặng</Thc>
            <Thc className="w-20 text-right">Số ngày</Thc>
            <Thc></Thc>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid} className={TR_CLS}>
              <td className={TD_CLS}>
                <Cell value={r.name} onChange={(v) => upd(r.uid, "name", v)} width="w-64" />
              </td>
              <td className={TD_CLS}>
                <Cell value={r.days} onChange={(v) => upd(r.uid, "days", v)} width="w-20" align="right" />
              </td>
              <RowTools
                onUp={() => move(r.uid, -1)}
                onDown={() => move(r.uid, 1)}
                onRemove={() => remove(r.uid)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Tiến độ thanh toán (ghi chú 8) — phải cộng đủ 100% mới lưu được. */
export function PaymentsPanel({
  api,
  tongPhanTram,
}: {
  api: RowsApi<PaymentRow>;
  tongPhanTram: number;
}) {
  const { rows, upd, add, remove, move } = api;
  const lech = rows.length > 0 && Math.abs(tongPhanTram - 100) > 0.01;

  return (
    <Panel
      title="Tiến độ thanh toán"
      hint="Phải cộng đủ 100% mới lưu được mẫu — mẫu sai sẽ đẻ ra hàng loạt báo giá sai."
      count={rows.length}
      onAdd={add}
    >
      <table className={TABLE_CLS}>
        <thead className={THEAD_CLS}>
          <tr>
            <Thc>Đợt</Thc>
            <Thc className="w-16 text-right">%</Thc>
            <Thc className="w-28">Căn cứ</Thc>
            <Thc>Ghi chú</Thc>
            <Thc></Thc>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid} className={TR_CLS}>
              <td className={TD_CLS}>
                <Cell value={r.label} onChange={(v) => upd(r.uid, "label", v)} width="w-56" />
              </td>
              <td className={TD_CLS}>
                <Cell value={r.percent} onChange={(v) => upd(r.uid, "percent", v)} width="w-16" align="right" />
              </td>
              <td className={TD_CLS}>
                <Cell
                  value={r.basis}
                  onChange={(v) => upd(r.uid, "basis", v)}
                  width="w-28"
                  list="basis-list"
                  placeholder="GTHĐ"
                />
              </td>
              <td className={TD_CLS}>
                <Cell value={r.note} onChange={(v) => upd(r.uid, "note", v)} width="w-44" />
              </td>
              <RowTools
                onUp={() => move(r.uid, -1)}
                onDown={() => move(r.uid, 1)}
                onRemove={() => remove(r.uid)}
              />
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-2 py-1.5 text-right text-xs font-medium text-slate-600">Cộng</td>
              <td
                className={`px-2 py-1.5 text-right text-xs font-semibold ${
                  lech ? "text-red-600" : "text-green-700"
                }`}
              >
                {Math.round(tongPhanTram * 100) / 100}%
              </td>
              <td colSpan={3} />
            </tr>
          )}
        </tbody>
      </table>
      <datalist id="basis-list">
        <option value="GTHĐ" />
        <option value="Quyết toán" />
      </datalist>
    </Panel>
  );
}
