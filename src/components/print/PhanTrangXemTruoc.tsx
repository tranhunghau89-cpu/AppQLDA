"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Chia nội dung trang in thành từng tờ A4 ngay trên màn hình, đúng như khi in.
 *
 * Dùng Paged.js: nó đọc quy tắc @page/break-* rồi cắt nội dung ra từng tờ giấy, nên
 * chỗ ngắt trang khi xem trước trùng với chỗ ngắt khi in. Bản gốc vẫn nằm trong DOM
 * (ẩn trên màn hình, hiện khi in) — lệnh in của trình duyệt in bản gốc chứ không in
 * các tờ đã cắt, để không phụ thuộc vào Paged.js lúc in thật.
 */
const CSS_TRANG = `
@page { size: A4; margin: 20mm 15mm 20mm 30mm;
  @bottom-right { content: counter(page) "/" counter(pages); font-size: 9pt; color: #64748b; } }
.trang-in { margin: 0 !important; padding: 0 !important; max-width: none !important;
  min-height: 0 !important; box-shadow: none !important; }
tr, img, .giu-nguyen-khoi { break-inside: avoid; }
.sang-trang-moi { break-before: page; }
`;

export function PhanTrangXemTruoc({ children }: { children: ReactNode }) {
  const goc = useRef<HTMLDivElement>(null);
  const dich = useRef<HTMLDivElement>(null);
  // Paged.js lỗi hoặc treo (tải thư viện hỏng, trình duyệt dừng requestAnimationFrame…)
  // thì hiện bản liền một khối — thà không chia trang còn hơn khung xem trước trắng trơn.
  const [hong, setHong] = useState(false);
  const [xong, setXong] = useState(false);

  useEffect(() => {
    let huy = false;
    const henGio = setTimeout(() => !huy && setHong(true), 10000);
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
      clearTimeout(henGio);
      if (!huy) setXong(true);
    })().catch((loi) => {
      console.error("Không chia trang được bản xem trước:", loi);
      clearTimeout(henGio);
      if (!huy) setHong(true);
    });
    return () => {
      huy = true;
      clearTimeout(henGio);
    };
  }, []);

  return (
    <>
      <div ref={goc} className={hong ? "" : "hidden print:block"}>
        {children}
      </div>
      {!hong && !xong && (
        <p className="py-16 text-center text-sm text-slate-400 print:hidden">Đang chia trang…</p>
      )}
      <div ref={dich} className={hong ? "hidden" : "xem-truoc-phan-trang print:hidden"} />
    </>
  );
}
