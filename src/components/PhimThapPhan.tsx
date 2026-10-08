"use client";

import { useEffect } from "react";

/**
 * Phím "." trên bàn phím số (NumpadDecimal) gõ ra "," trong ô nhập số.
 *
 * App đọc số kiểu Việt: "." là phân cách nghìn, "," là thập phân. Bàn phím số chỉ có
 * phím chấm nên gõ "7863.33" bị đọc thành 786.333. Đổi ký tự ngay lúc gõ — giữ nguyên
 * quy ước hiển thị và bộ đọc số. Chỉ áp cho ô inputMode decimal/numeric.
 */
export function PhimThapPhan() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "NumpadDecimal" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      const mode = el.inputMode;
      if (mode !== "decimal" && mode !== "numeric") return;
      if (el.readOnly || el.disabled) return;
      e.preventDefault();
      // insertText đi qua luồng nhập liệu thật → React nhận onChange, Ctrl+Z vẫn hoạt động.
      if (!document.execCommand("insertText", false, ",")) {
        const s = el.selectionStart ?? el.value.length;
        el.setRangeText(",", s, el.selectionEnd ?? s, "end");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
