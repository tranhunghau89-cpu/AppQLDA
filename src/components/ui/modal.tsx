"use client";

import * as React from "react";
import { X } from "lucide-react";

const MODAL_WIDTH: Record<string, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

/** Các phần tử có thể nhận focus bên trong hộp thoại. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  /**
   * `onClose` giữ trong ref, KHÔNG đưa vào mảng phụ thuộc bên dưới.
   *
   * Mọi chỗ gọi đều truyền một hàm mũi tên viết thẳng tại chỗ (`onClose={() => setMo(false)}`),
   * nên nó mang định danh MỚI sau mỗi lần vẽ lại. Để nó trong deps thì effect chạy lại
   * theo từng lần vẽ — và effect có việc "đưa focus về phần tử đầu tiên". Hậu quả: gõ
   * một ký tự vào ô có kiểm soát trong hộp thoại là focus nhảy về nút X, không gõ tiếp
   * được. Hộp thoại dùng `defaultValue` không lộ ra vì chúng không vẽ lại mỗi phím.
   */
  const dongRef = React.useRef(onClose);
  React.useEffect(() => {
    dongRef.current = onClose;
  });

  // Esc để đóng + giữ focus trong hộp thoại (Tab không thoát ra nền).
  // Chỉ phụ thuộc `open`: mở ra đặt focus một lần, rồi không giành lại nữa.
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const truocDo = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dongRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (els.length === 0) return;
      const dau = els[0];
      const cuoi = els[els.length - 1];
      if (e.shiftKey && document.activeElement === dau) {
        e.preventDefault();
        cuoi.focus();
      } else if (!e.shiftKey && document.activeElement === cuoi) {
        e.preventDefault();
        dau.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const cuonCu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = cuonCu;
      truocDo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Điện thoại: dán đáy màn hình, bo góc trên, cuộn được. Desktop: hộp giữa.
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[85dvh] sm:rounded-xl ${MODAL_WIDTH[size]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 id={titleId} className="min-w-0 text-base font-semibold text-slate-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
