import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ẩn cột phụ dưới một breakpoint để bảng đọc được trên điện thoại.
 * Bảng vẫn cuộn ngang được, nhưng cuộn 8 cột trên màn 375px là không dùng nổi —
 * nên các cột thứ yếu được ẩn hẳn và chỉ hiện lại khi màn đủ rộng.
 */
type Hide = "sm" | "md" | "lg" | "xl";

const HIDE: Record<Hide, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse border border-slate-200 text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-slate-300 bg-slate-100 text-left text-slate-700",
        className
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  hideBelow,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { hideBelow?: Hide }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-r border-slate-200 px-3 py-2 font-semibold last:border-r-0",
        hideBelow && HIDE[hideBelow],
        className
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-slate-200 hover:bg-slate-50/60", className)}
      {...props}
    />
  );
}

export function Td({
  className,
  hideBelow,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { hideBelow?: Hide }) {
  return (
    <td
      className={cn(
        "border-r border-slate-100 px-3 py-2 text-slate-700 last:border-r-0",
        hideBelow && HIDE[hideBelow],
        className
      )}
      {...props}
    />
  );
}
