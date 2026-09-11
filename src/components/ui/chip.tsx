"use client";

import { cn } from "@/lib/utils";

/**
 * Nút chọn dạng viên thuốc — thay cho <select> khi chỉ có vài lựa chọn.
 *
 * Mọi lựa chọn nằm sẵn trước mắt, một cú bấm là xong, và nhìn là biết đang chọn gì mà
 * không phải mở ra. Dùng `aria-pressed` chứ không phải `role="radio"` vì có chỗ chọn
 * một, có chỗ chọn nhiều.
 */
export function Chip({
  chon,
  tat,
  onClick,
  children,
}: {
  chon: boolean;
  /** Lựa chọn không dùng được trong ngữ cảnh hiện tại — mờ đi chứ không biến mất. */
  tat?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={chon}
      disabled={tat}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        tat
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
          : chon
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}
