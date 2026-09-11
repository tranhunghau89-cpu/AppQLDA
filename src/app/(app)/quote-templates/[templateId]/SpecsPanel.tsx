"use client";

import { QUOTE_SPEC_GROUP, VAT_TU_TAG } from "@/lib/constants";
import { Panel, Cell, RowTools, Thc, TABLE_CLS, THEAD_CLS, TR_CLS, TD_CLS } from "./PanelParts";
import type { RowsApi } from "./useRows";
import type { SpecRow } from "./types";

/** Bảng "Vật liệu áp dụng và thông số kỹ thuật" — mục 2 của văn bản báo giá. */
export function SpecsPanel({ api }: { api: RowsApi<SpecRow> }) {
  const { rows, upd, add, remove, move } = api;

  return (
    <Panel
      title="Vật liệu & thông số kỹ thuật"
      hint="Để “Dùng chung” cho thứ công trình nào cũng có (que hàn, sơn, bulong); gắn nhãn cho thứ chỉ xuất hiện khi báo giá có hạng mục tương ứng. “Nhắc lại” = in thêm dòng này dưới tên hạng mục, chỉ nên bật cho dòng tôn."
      count={rows.length}
      onAdd={add}
    >
      <table className={TABLE_CLS}>
        <thead className={THEAD_CLS}>
          <tr>
            <Thc className="w-14">Nhóm</Thc>
            <Thc className="w-36">Loại vật tư</Thc>
            <Thc>Nội dung</Thc>
            <Thc>Thông số kỹ thuật</Thc>
            <Thc>Ghi chú và xuất xứ</Thc>
            <Thc className="w-20 text-center">Nhắc lại</Thc>
            <Thc></Thc>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid} className={TR_CLS}>
              <td className={TD_CLS}>
                <select
                  value={r.groupCode}
                  onChange={(e) => upd(r.uid, "groupCode", e.target.value)}
                  className="w-14 rounded border border-slate-200 px-1 py-1 text-xs"
                >
                  {QUOTE_SPEC_GROUP.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.value}
                    </option>
                  ))}
                </select>
              </td>
              <td className={TD_CLS}>
                <select
                  value={r.tag}
                  onChange={(e) => upd(r.uid, "tag", e.target.value)}
                  className="w-36 rounded border border-slate-200 px-1 py-1 text-xs"
                >
                  <option value="">— Dùng chung —</option>
                  {VAT_TU_TAG.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={TD_CLS}>
                <Cell value={r.name} onChange={(v) => upd(r.uid, "name", v)} width="w-48" />
              </td>
              <td className={TD_CLS}>
                <Cell value={r.spec} onChange={(v) => upd(r.uid, "spec", v)} width="w-40" />
              </td>
              <td className={TD_CLS}>
                <Cell value={r.origin} onChange={(v) => upd(r.uid, "origin", v)} width="w-44" />
              </td>
              <td className={`${TD_CLS} text-center`}>
                <input
                  type="checkbox"
                  checked={r.inDescription}
                  onChange={(e) => upd(r.uid, "inDescription", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label={`Nhắc lại "${r.name}" dưới tên hạng mục`}
                />
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
