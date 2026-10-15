"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface TabMeta {
  id: string;
  ten: string;
  /** Các mục (id cũ dạng #tien-do, #bao-hanh…) nằm trong tab này — đường dẫn cũ vẫn mở đúng tab. */
  muc: string[];
  canChuY?: boolean;
  /** Số nhỏ cạnh tên tab (vd. phiếu bảo hành đang mở). */
  dem?: number;
}

const Ctx = createContext<{ tab: string; chon: (id: string) => void; tabs: TabMeta[] } | null>(null);

function useTab() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Cần đặt trong <KhungTab>.");
  return c;
}

/** Tab chứa mục có id này (hoặc chính tab có id này). */
function tabCuaMuc(tabs: TabMeta[], id: string): string | null {
  return tabs.find((t) => t.id === id || t.muc.includes(id))?.id ?? null;
}

/** Mở mục thu gọn chứa #id và cuộn tới — chạy SAU khi tab đã hiện. */
function moVaCuon(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const d = el instanceof HTMLDetailsElement ? el : el.closest("details");
  if (d) d.open = true;
  el.scrollIntoView({ block: "start" });
}

/**
 * Trang dự án theo tab. Giữ tab trong #hash: tải lại / gửi link vẫn mở đúng chỗ, và các
 * link cũ trỏ thẳng vào mục (#tien-do, #bao-hanh — trong tin nhắn, hộp thư) tự chuyển tab.
 */
export function KhungTab({ tabs, children }: { tabs: TabMeta[]; children: React.ReactNode }) {
  const [tab, setTab] = useState(tabs[0].id);
  const [cho, setCho] = useState<string | null>(null);

  useEffect(() => {
    const theoHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      const t = tabCuaMuc(tabs, id);
      if (t) {
        setTab(t);
        // Hash là chính tab thì không cuộn — chỉ chuyển tab.
        setCho(t === id ? null : id);
      } else {
        // Hash ngoài tab (vd. #thao-luan ở cột phải) — cuộn như link thường.
        moVaCuon(id);
      }
    };
    theoHash();
    window.addEventListener("hashchange", theoHash);
    return () => window.removeEventListener("hashchange", theoHash);
  }, [tabs]);

  useEffect(() => {
    if (!cho) return;
    const r = requestAnimationFrame(() => moVaCuon(cho));
    return () => cancelAnimationFrame(r);
  }, [tab, cho]);

  function chon(id: string) {
    setTab(id);
    setCho(null);
    history.replaceState(null, "", `#${id}`);
  }

  return <Ctx.Provider value={{ tab, chon, tabs }}>{children}</Ctx.Provider>;
}

/** Nội dung một tab — tab khác vẫn dựng sẵn (giữ trạng thái form), chỉ ẩn đi. */
export function TabNoiDung({ id, children }: { id: string; children: React.ReactNode }) {
  const { tab } = useTab();
  return (
    <div role="tabpanel" hidden={tab !== id} className="space-y-4">
      {children}
    </div>
  );
}

/** Nút chuyển tab ở bất kỳ đâu (thẻ tóm tắt ở tab Tổng quan). */
export function NutTab({ den, className, children }: { den: string; className?: string; children: React.ReactNode }) {
  const { chon } = useTab();
  return (
    <button type="button" onClick={() => chon(den)} className={className}>
      {children}
    </button>
  );
}

/** Danh sách tab: dọc ở cột trái (màn hình rộng), ngang trên đầu (màn hình hẹp). */
export function DanhSachTab({ doc }: { doc?: boolean }) {
  const { tab, chon, tabs } = useTab();
  return (
    <nav
      role="tablist"
      aria-label="Nội dung dự án"
      className={
        doc
          ? "rounded-lg border border-slate-200 bg-white p-2 text-sm"
          : "sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 text-sm shadow-sm backdrop-blur [scrollbar-width:none]"
      }
    >
      {tabs.map((t) => {
        const dang = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={dang}
            onClick={() => chon(t.id)}
            className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left ${doc ? "w-full" : ""} ${
              dang ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{t.ten}</span>
            {t.dem ? (
              <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{t.dem}</span>
            ) : t.canChuY ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
