import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuyTrinh } from "@/lib/quyTrinhBaoGia";

/**
 * Thanh các bước ở đầu trang quy trình. Bước đã mở được (≤ `toiDa`) bấm vào để quay
 * lại xem/sửa; bước sau đó mờ đi — muốn tới phải bấm "Tiếp".
 */
export function ThanhBuoc({
  qt,
  hienTai,
  toiDa,
  hrefBuoc,
}: {
  qt: QuyTrinh;
  hienTai: number;
  toiDa: number;
  /** `null` = chưa có cơ hội, chưa bấm sang bước nào được. */
  hrefBuoc: ((n: number) => string) | null;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {qt.buoc.map((b, i) => {
        const n = i + 1;
        const xong = n < toiDa || (n === toiDa && n < hienTai);
        const dangO = n === hienTai;
        const moDuoc = hrefBuoc && n <= toiDa && !dangO;
        const noiDung = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
              dangO && "border-blue-600 bg-blue-600 text-white",
              !dangO &&
                n <= toiDa &&
                "border-slate-300 bg-white text-slate-700",
              n > toiDa && "border-slate-200 bg-slate-50 text-slate-400",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                dangO
                  ? "bg-white text-blue-600"
                  : xong
                    ? "bg-green-600 text-white"
                    : "bg-slate-200",
              )}
            >
              {xong && !dangO ? <Check className="h-3 w-3" /> : n}
            </span>
            {b.ten}
          </span>
        );
        return (
          <li key={b.loai} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">›</span>}
            {moDuoc ? (
              <Link href={hrefBuoc(n)} className="hover:opacity-80">
                {noiDung}
              </Link>
            ) : (
              noiDung
            )}
          </li>
        );
      })}
    </ol>
  );
}
