// Đọc ô Excel qua ExcelJS — phần này bị lặp lại gần như nguyên văn ở cả 9 script
// import. Gom về một chỗ để có test, vì đây là nơi dễ sai nhất khi bóc file.
import type { CellValue } from "exceljs";

export { norm } from "@/lib/text";

/**
 * Lấy số từ một ô.
 *
 * ExcelJS trả về ô công thức dưới dạng `{ formula, result }` — nếu chỉ kiểm tra
 * `typeof v === "number"` thì mọi ô công thức đều thành null, và file dự toán thì
 * đầy công thức.
 */
export function num(v: CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v && typeof v === "object") {
    const o = v as { result?: unknown };
    if (typeof o.result === "number") return Number.isFinite(o.result) ? o.result : null;
  }
  return null;
}

/** Lấy chữ từ một ô, xử lý cả richText, ô công thức và ô ngày. */
export function text(v: CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as {
      richText?: { text: string }[];
      result?: unknown;
      text?: string;
      hyperlink?: string;
    };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.result === "string") return o.result.trim();
    if (typeof o.result === "number") return String(o.result);
    if (o.text) return String(o.text).trim();
  }
  return "";
}

/** Lấy ngày từ một ô (Date thật hoặc chuỗi ISO). */
export function date(v: CellValue): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const t = text(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Rút "K25L60" từ tên file "K25L60_PT" để khớp dự án theo kích thước khung. */
export function dims(fileBase: string): string | null {
  const m = fileBase.match(/^(K\d+L\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Giao dien toi thieu cua mot worksheet - de test khong can file Excel that.
 * `columnCount` la tuy chon vi chi vai bo boc tach can toi no.
 */
export interface SheetLike {
  rowCount: number;
  columnCount?: number;
  getCell(row: number, col: number): { value: CellValue };
}
