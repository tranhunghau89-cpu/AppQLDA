import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const vnd = new Intl.NumberFormat("vi-VN");

/** Định dạng số kiểu Việt Nam (1.234.567). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return vnd.format(Math.round(value));
}

/** Định dạng tiền VND. */
export function formatVND(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${vnd.format(Math.round(value))} ₫`;
}

/** Định dạng ngày dd/MM/yyyy. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}
