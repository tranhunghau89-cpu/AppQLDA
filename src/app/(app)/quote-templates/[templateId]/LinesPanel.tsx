"use client";

import { VAT_TU_TAG } from "@/lib/constants";
import { Panel, Cell, RowTools, Thc, TABLE_CLS, THEAD_CLS, TR_CLS, TD_CLS } from "./PanelParts";
import type { RowsApi } from "./useRows";
import type { LineRow } from "./types";

/**
 * Các hạng mục mặc định của mẫu.
 *
 * "Phần nguồn" là mã phần bên báo giá chi tiết dùng để suy đơn giá m² khi bấm
 * "Tạo báo giá gửi khách" — để trống thì dòng dùng đơn giá mặc định ở đây.
 */
export function LinesPanel({ api }: { api: RowsApi<LineRow> }) {
  const { rows, upd, add, remove, move } = api;

  function toggleTag(uid: string, tag: string, on: boolean) {
    const r = rows.find((x) => x.uid === uid);
    if (!r) return;
    upd(uid, "tags", on ? [...r.tags, tag] : r.tags.filter((t) => t !== tag));
  }

  return (
    <Panel
      title="Hạng mục mặc định"
      hint="Nhãn vật tư quyết định bảng vật liệu in ra dòng nào, và sinh mô tả dưới tên hạng mục."
      count={rows.length}
      onAdd={add}
    >
      <table className={TABLE_CLS}>
        <thead className={THEAD_CLS}>
          <tr>
            <Thc className="w-10">Phần</Thc>
            <Thc className="w-10">STT</Thc>
            <Thc>Nội dung công việc</Thc>
            <Thc className="w-12">ĐV</Thc>
            <Thc className="w-24 text-right">Đơn giá</Thc>
            <Thc className="w-16">Phần nguồn</Thc>
            <Thc>Nhãn vật tư</Thc>
            <Thc></Thc>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className={TR_CLS}>
              <td colSpan={8} className="px-3 py-3 text-xs text-slate-400">
                Chưa có hạng mục. Để trống cũng được — khi sinh báo giá từ bản chi tiết,
                hạng mục sẽ lấy thẳng từ các phần của báo giá đó.
              </td>
            </tr>
          )}
          {rows.map((l) => (
            <tr key={l.uid} className={TR_CLS}>
              <td className={TD_CLS}>
                <Cell value={l.partCode} onChange={(v) => upd(l.uid, "partCode", v)} width="w-10" placeholder="I" />
              </td>
              <td className={TD_CLS}>
                <Cell value={l.code} onChange={(v) => upd(l.uid, "code", v)} width="w-10" placeholder="01" />
              </td>
              <td className={TD_CLS}>
                <Cell value={l.name} onChange={(v) => upd(l.uid, "name", v)} width="w-64" />
                <textarea
                  value={l.detail}
                  onChange={(e) => upd(l.uid, "detail", e.target.value)}
                  rows={2}
                  placeholder="Mô tả riêng (để trống = mô tả chung + vật tư đã gắn)"
                  className="mt-1 w-64 rounded border border-slate-200 px-1.5 py-1 text-xs"
                />
              </td>
              <td className={TD_CLS}>
                <Cell value={l.unit} onChange={(v) => upd(l.uid, "unit", v)} width="w-12" placeholder="m2" />
              </td>
              <td className={TD_CLS}>
                <Cell value={l.price} onChange={(v) => upd(l.uid, "price", v)} width="w-24" align="right" />
              </td>
              <td className={TD_CLS}>
                <Cell
                  value={l.sourceSectionCode}
                  onChange={(v) => upd(l.uid, "sourceSectionCode", v)}
                  width="w-16"
                  placeholder="A"
                />
              </td>
              <td className={TD_CLS}>
                <div className="flex w-56 flex-wrap gap-x-3 gap-y-1 py-1">
                  {VAT_TU_TAG.map((t) => (
                    <label key={t.value} className="flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300"
                        checked={l.tags.includes(t.value)}
                        onChange={(e) => toggleTag(l.uid, t.value, e.target.checked)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </td>
              <RowTools
                onUp={() => move(l.uid, -1)}
                onDown={() => move(l.uid, 1)}
                onRemove={() => remove(l.uid)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
