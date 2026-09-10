"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * Thanh công cụ của trang in — chỉ hiện trên màn hình, `khong-in` bỏ nó khi in.
 *
 * Không có thư viện PDF nào ở đây: `window.print()` mở đúng hộp thoại in sẵn có của
 * trình duyệt, ở đó chọn "Lưu thành PDF". Cách này giữ nguyên phông chữ tiếng Việt,
 * tự ngắt trang, và người dùng xem trước được trước khi lưu.
 */
export function PrintToolbar({ quayVe, nhan }: { quayVe: string; nhan: string }) {
  return (
    <div className="khong-in sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 print:hidden">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link
          href={quayVe}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {nhan}
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:inline">
            Trong hộp thoại in, chọn <strong>Lưu thành PDF</strong> và tắt phần đầu/chân
            trang của trình duyệt.
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            In / Lưu PDF
          </button>
        </div>
      </div>
    </div>
  );
}
