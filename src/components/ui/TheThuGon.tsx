"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Thẻ trắng thu gọn được: bấm tiêu đề để ẩn/hiện nội dung.
 *
 * Nhớ trạng thái theo `khoa` trong trình duyệt của từng người (thu gọn một lần là lần
 * sau vẫn gọn). Đọc sau khi gắn để HTML máy chủ và máy khách khớp nhau.
 *
 * `phai` là chỗ cho công tắc hay nút ở góc tiêu đề — bấm vào đó không làm gập thẻ.
 */
export function TheThuGon({
  khoa,
  tieuDe,
  phai,
  children,
  coTieuDeLon = true,
}: {
  khoa: string;
  tieuDe: ReactNode;
  phai?: ReactNode;
  children: ReactNode;
  coTieuDeLon?: boolean;
}) {
  const [mo, setMo] = useState(true);
  const k = `the-thu-gon:${khoa}`;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- đọc lựa chọn đã lưu sau khi gắn
      if (localStorage.getItem(k) === "0") setMo(false);
    } catch {}
  }, [k]);

  function doi() {
    setMo((c) => {
      try {
        localStorage.setItem(k, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 p-5 pb-0">
        <button
          type="button"
          onClick={doi}
          aria-expanded={mo}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${mo ? "" : "-rotate-90"}`}
          />
          <h3 className={`font-semibold text-slate-900 ${coTieuDeLon ? "text-base" : "text-sm"}`}>{tieuDe}</h3>
        </button>
        {mo && phai}
      </div>
      <div className={mo ? "p-5 pt-3" : "pb-5"}>{mo && children}</div>
    </div>
  );
}
