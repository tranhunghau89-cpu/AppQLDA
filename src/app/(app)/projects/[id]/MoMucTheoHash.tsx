"use client";

import { useEffect } from "react";

/** Đi tới #id (từ mục lục, Việc QC, Việc quy trình…) mà mục đang thu gọn thì mở nó ra. */
export function MoMucTheoHash() {
  useEffect(() => {
    const mo = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      const d = el?.closest("details") ?? (el instanceof HTMLDetailsElement ? el : null);
      if (d && !d.open) {
        d.open = true;
        el?.scrollIntoView();
      }
    };
    mo();
    window.addEventListener("hashchange", mo);
    return () => window.removeEventListener("hashchange", mo);
  }, []);
  return null;
}
