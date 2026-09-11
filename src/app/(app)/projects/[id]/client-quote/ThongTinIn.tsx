"use client";

import { Pencil } from "lucide-react";
import { soOThieu, thongTinIn } from "@/lib/clientQuoteInfo";
import type { ClientQuoteView } from "./types";

/**
 * Dải thông tin in ra, đặt ngay đầu mỗi bản báo giá.
 *
 * Trước đây chín ô này chỉ mở được trong hộp thoại sửa, nên bản in thiếu SĐT người phụ
 * trách thì không có gì trên màn hình nói ra. Đặt lên đầu để lập xong là thấy ngay còn
 * trống chỗ nào, và chính chữ "điền" là chỗ bấm để mở hộp thoại.
 */
export function ThongTinIn({
  q,
  canEdit,
  onEdit,
}: {
  q: ClientQuoteView;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const o = thongTinIn(q);
  const thieu = soOThieu(o);

  return (
    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Thông tin in trên bản báo giá
        </span>
        {thieu > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            còn {thieu} ô chưa điền
          </span>
        ) : (
          <span className="text-xs text-slate-400">đã điền đủ</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Sửa thông tin
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
        {o.map((x) => (
          <div key={x.nhan} className="min-w-0">
            <dt className="truncate text-[11px] uppercase tracking-wide text-slate-400">
              {x.nhan}
            </dt>
            <dd className="truncate text-sm" title={x.giaTri || undefined}>
              {x.giaTri ? (
                <span className="text-slate-800">{x.giaTri}</span>
              ) : canEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="font-medium text-amber-600 hover:underline"
                >
                  + điền
                </button>
              ) : (
                <span className="text-amber-600">chưa điền</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
