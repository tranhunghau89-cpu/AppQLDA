// Khung "mục" của trang dự án: đánh số, thu gọn được (<details> gốc — chạy cả khi JS chưa tải),
// kèm mục lục nhảy nhanh. Mặc định THU GỌN; phần tự mở theo #hash nằm ở MoMucTheoHash.
import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface MucLucItem {
  id: string;
  so: number;
  tieuDe: string;
  /** Chấm màu cạnh tên: mục đang có việc cần chú ý. */
  canChuY?: boolean;
}

export function MucLuc({ muc }: { muc: MucLucItem[] }) {
  return (
    <nav
      aria-label="Mục lục dự án"
      className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur"
    >
      {muc.map((m) => (
        <a
          key={m.id}
          href={`#${m.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-600">
            {m.so}
          </span>
          {m.tieuDe}
          {m.canChuY && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        </a>
      ))}
    </nav>
  );
}

export function MucDuAn({
  id,
  so,
  tieuDe,
  tomTat,
  hanhDong,
  mo = false,
  children,
}: {
  id: string;
  so: number;
  tieuDe: string;
  /** Một dòng tóm tắt hiện cạnh tiêu đề — vẫn thấy khi đã thu gọn. */
  tomTat?: React.ReactNode;
  /** Nút / liên kết bên phải tiêu đề (bấm không làm đóng mở mục). */
  hanhDong?: React.ReactNode;
  mo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={mo}
      className="group scroll-mt-32 rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 group-open:rounded-b-none group-open:border-b group-open:border-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold tabular-nums text-white">
          {so}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-slate-900">{tieuDe}</span>
          {tomTat && (
            <span className="ml-2 text-sm font-normal text-slate-500">{tomTat}</span>
          )}
        </span>
        {hanhDong}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
}

/** Nhãn nhỏ trên giá trị — dùng cho lưới thông tin gọn. */
export function OThongTin({
  nhan,
  children,
  rong,
}: {
  nhan: string;
  children: React.ReactNode;
  rong?: boolean;
}) {
  return (
    <div className={rong ? "col-span-2 sm:col-span-3" : undefined}>
      <dt className="text-xs text-slate-500">{nhan}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}
