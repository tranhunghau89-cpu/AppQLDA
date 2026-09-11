"use client";

import type { ReactNode } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Khung một bảng con của mẫu: tiêu đề + số dòng + nút thêm. */
export function Panel({
  title,
  hint,
  count,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0">
          <span className="font-semibold text-slate-800">
            {title} ({count})
          </span>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Thêm dòng
        </Button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Thc({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-2 py-1.5 text-left font-medium ${className}`}>{children}</th>;
}

/** Ô nhập gọn trong bảng — cùng một kiểu dáng ở cả bốn bảng con. */
export function Cell({
  value,
  onChange,
  width = "w-28",
  align = "left",
  placeholder,
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  width?: string;
  align?: "left" | "right";
  placeholder?: string;
  list?: string;
}) {
  return (
    <input
      list={list}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      inputMode={align === "right" ? "decimal" : undefined}
      className={`${width} rounded border border-slate-200 px-1.5 py-1 text-xs ${
        align === "right" ? "text-right" : ""
      }`}
    />
  );
}

/** Cột cuối: lên / xuống / xóa. */
export function RowTools({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <td className="whitespace-nowrap px-1 py-0.5 text-right align-top">
      <button onClick={onUp} className="p-0.5 text-slate-400 hover:text-slate-700" title="Lên" aria-label="Lên">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDown} className="p-0.5 text-slate-400 hover:text-slate-700" title="Xuống" aria-label="Xuống">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={onRemove} className="p-0.5 text-red-500 hover:text-red-700" title="Xóa dòng" aria-label="Xóa dòng">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </td>
  );
}

export const TABLE_CLS = "w-full text-sm";
export const THEAD_CLS = "bg-slate-50 text-xs text-slate-500";
export const TR_CLS = "border-t border-slate-100 align-top";
export const TD_CLS = "px-1 py-0.5";
