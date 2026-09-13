"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { laBamChuyenTrang, laYeuCauCanCho } from "@/lib/taiTrang";

/**
 * Thanh mảnh chạy trên đầu trang trong lúc app đang làm việc người dùng vừa ra lệnh:
 * chuyển trang, hoặc bấm một nút gọi server (Lưu, Xoá, Áp bộ…).
 *
 * Trước đây bấm xong không có gì thay đổi trong vài giây — người dùng không biết mình đã
 * bấm trúng chưa, và thường bấm thêm lần nữa.
 *
 * Hai nguồn tín hiệu, vì mỗi nguồn hụt một chỗ:
 *   - Cú bấm liên kết: bật NGAY lúc bấm, trước cả khi có yêu cầu mạng nào. Tắt khi địa chỉ
 *     trang đổi.
 *   - Yêu cầu mạng của Next (tải trang, server action, router.refresh sau khi lưu): bắt
 *     cả những lần chuyển trang bằng `router.push` và mọi nút gọi server — không phải
 *     sửa từng chỗ gọi. Tắt khi dữ liệu trả về đã tải HẾT, không phải khi vừa có header.
 *
 * Thanh chỉ là tín hiệu, không phải số đo: nó chạy nhanh tới ~35% rồi chậm dần về 90%,
 * và chạy nốt tới 100% khi xong. Không có cách biết trước một trang còn bao lâu.
 */
export function ThanhTaiTrang() {
  const thanh = useRef<HTMLDivElement>(null);
  const ketBam = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = thanh.current;
    if (!el) return;
    let dangCho = 0;
    let henAn: ReturnType<typeof setTimeout> | undefined;

    const capNhat = () => {
      const html = document.documentElement;
      if (dangCho > 0) {
        clearTimeout(henAn);
        if (el.dataset.pha !== "chay") {
          el.style.transform = "";
          el.dataset.pha = "chay";
        }
        html.dataset.dangTai = "";
      } else if (el.dataset.pha === "chay") {
        // Giữ nguyên chỗ thanh đang dừng rồi mới chạy nốt: bỏ animation ra là thanh nhảy
        // về 0 trước khi kịp chạy tới 100%.
        el.style.transform = getComputedStyle(el).transform;
        el.dataset.pha = "xong";
        void el.offsetWidth;
        el.style.transform = "scaleX(1)";
        delete html.dataset.dangTai;
        henAn = setTimeout(() => {
          el.dataset.pha = "an";
          el.style.transform = "";
        }, 500);
      }
    };

    /** Bắt đầu một việc; trả hàm kết thúc (gọi nhiều lần cũng chỉ tính một). */
    const batDau = (toiDaMs: number) => {
      dangCho++;
      capNhat();
      let xong = false;
      const ket = () => {
        if (xong) return;
        xong = true;
        clearTimeout(henHuy);
        dangCho--;
        capNhat();
      };
      // Lưới an toàn: một yêu cầu treo không được giữ thanh chạy mãi.
      const henHuy = setTimeout(ket, toiDaMs);
      return ket;
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const chuyen = laBamChuyenTrang({
        href: a.getAttribute("href"),
        target: a.getAttribute("target"),
        coDownload: a.hasAttribute("download"),
        nut: e.button,
        coPhimBoTro: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
        hienTai: window.location.href,
      });
      if (!chuyen) return;
      ketBam.current?.();
      ketBam.current = batDau(15_000);
    };
    // Pha "bubble" chứ không phải "capture": để `e.defaultPrevented` phản ánh đúng những
    // liên kết mà code của trang đã tự chặn.
    document.addEventListener("click", onClick);

    const w = window as typeof window & { __qldaFetchGoc?: typeof fetch };
    const goc = w.__qldaFetchGoc ?? window.fetch;
    w.__qldaFetchGoc = goc;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const h = init?.headers;
      const headers =
        h instanceof Headers
          ? Object.fromEntries(h.entries())
          : Array.isArray(h)
            ? Object.fromEntries(h)
            : (h as Record<string, string> | undefined);
      if (!laYeuCauCanCho(headers)) return goc.call(window, input, init);
      const ket = batDau(60_000);
      const p = goc.call(window, input, init);
      p.then(
        // Đọc hết một BẢN SAO của phản hồi: trang chỉ thật sự xong khi luồng dữ liệu
        // stream về đã hết, còn header thì tới gần như ngay lập tức.
        (res) => res.clone().arrayBuffer().then(ket, ket),
        ket
      );
      return p;
    } as typeof fetch;

    return () => {
      document.removeEventListener("click", onClick);
      window.fetch = goc;
      clearTimeout(henAn);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
        <div ref={thanh} data-pha="an" className="thanh-tai" />
      </div>
      <Suspense fallback={null}>
        <KhiDoiTrang onDoi={() => {
          ketBam.current?.();
          ketBam.current = null;
        }} />
      </Suspense>
    </>
  );
}

/** Gọi `onDoi` mỗi khi đường dẫn hoặc tham số tìm kiếm đổi — tức trang mới đã hiện. */
function KhiDoiTrang({ onDoi }: { onDoi: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const ham = useRef(onDoi);
  useEffect(() => {
    ham.current = onDoi;
  });
  useEffect(() => {
    ham.current();
  }, [pathname, search]);
  return null;
}
