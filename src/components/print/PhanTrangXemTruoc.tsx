"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Chia nội dung trang in thành từng tờ A4 ngay trên màn hình, đúng như khi in.
 *
 * Dùng Paged.js: nó đọc quy tắc @page/break-* rồi cắt nội dung ra từng tờ giấy, nên
 * chỗ ngắt trang khi xem trước trùng với chỗ ngắt khi in. Bản gốc vẫn nằm trong DOM
 * (ẩn trên màn hình, hiện khi in) — lệnh in của trình duyệt in bản gốc chứ không in
 * các tờ đã cắt, để không phụ thuộc vào Paged.js lúc in thật.
 */
const CSS_TRANG = `
@page { size: A4; margin: 15mm; }
.trang-in { margin: 0 !important; padding: 0 !important; max-width: none !important;
  min-height: 0 !important; box-shadow: none !important; }
tr, img, .giu-nguyen-khoi { break-inside: avoid; }
.sang-trang-moi { break-before: page; }
`;

export function PhanTrangXemTruoc({ children }: { children: ReactNode }) {
  const goc = useRef<HTMLDivElement>(null);
  const dich = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let huy = false;
    (async () => {
      const { Previewer } = await import("pagedjs");
      if (huy || !goc.current || !dich.current) return;
      dich.current.innerHTML = "";
      const noiDung = goc.current.cloneNode(true) as HTMLElement;
      noiDung.removeAttribute("hidden");
      await new Previewer().preview(
        noiDung.innerHTML,
        [{ [window.location.href]: CSS_TRANG }],
        dich.current,
      );
    })();
    return () => {
      huy = true;
    };
  }, []);

  return (
    <>
      <div ref={goc} className="hidden print:block">
        {children}
      </div>
      <div ref={dich} className="xem-truoc-phan-trang print:hidden" />
    </>
  );
}
