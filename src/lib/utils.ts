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

const vndKhoiLuong = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Định dạng KHỐI LƯỢNG (m², kg, cái…) — giữ 2 chữ số thập phân.
 *
 * Không dùng `formatNumber` cho khối lượng: hàm đó làm tròn về số nguyên vì nó
 * sinh ra để in tiền. Dùng nhầm thì 15,60 m² in ra thành 16 và 714,5 m² thành
 * 715 — sai khối lượng ngay trên văn bản gửi cho chủ đầu tư.
 */
export function formatQty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return vndKhoiLuong.format(value);
}

/** Định dạng tiền VND. */
export function formatVND(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${vnd.format(Math.round(value))} ₫`;
}

/**
 * Parse số nhập kiểu Việt Nam: "." = phân cách nghìn, "," = thập phân.
 * "12.496,57" → 12496.57 · "1.130" → 1130 · "100.000.000" → 100000000.
 * Rỗng / không hợp lệ → null. (Dùng cho ô nhập text; ô <input type=number> không cần.)
 */
export function parseViNumber(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const t = (input ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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
