// Suy đơn giá m² của báo giá gửi khách TỪ báo giá chi tiết theo Mã CV.
//
// Ý tưởng: mỗi hạng mục trong báo giá gửi khách ("Gia công sản xuất, lắp dựng khung
// nhà thép... phần mái", m², 1.000, 695.000) ứng với một "phần" của báo giá chi tiết.
// Đơn giá m² = tổng tiền bán của phần đó ÷ diện tích của phần đó.
//
// Toàn bộ file này là logic thuần — không đụng Prisma — để test được và để chạy
// được ở cả hai phía.

import { roundVnd } from "./clientQuote";

/** Một "phần" của báo giá chi tiết (QuoteSection gốc). */
export interface SourceSection {
  id: string;
  code: string;
  area: number | null;
}

/** Khuôn một dòng hạng mục — đến từ mẫu báo giá, hoặc từ các dòng đang có. */
export interface DeriveSpec {
  partCode: string;
  partName: string;
  code: string | null;
  name: string;
  detail: string | null;
  unit: string | null;
  note: string | null;
  /**
   * Mã "phần" bên báo giá chi tiết dùng để suy đơn giá (A, B…).
   * Để trống = dòng này luôn nhập tay, dùng `defaultUnitPrice`.
   */
  sourceSectionCode: string | null;
  defaultUnitPrice: number | null;
}

export interface DerivedLine {
  partCode: string;
  partName: string;
  code: string | null;
  name: string;
  detail: string | null;
  unit: string | null;
  note: string | null;
  qty: number | null;
  unitPrice: number | null;
  /** Luôn null: để thành tiền tự tính lại theo khối lượng × đơn giá. */
  amount: null;
  sourceSectionId: string | null;
}

/**
 * Đơn giá trên một đơn vị diện tích.
 *
 * Diện tích thiếu, bằng 0 hoặc âm thì KHÔNG suy ra được — trả null. Tuyệt đối không
 * để lọt Infinity hay NaN vào một con số sẽ in ra báo giá gửi cho khách.
 */
export function unitPriceFromSection(subtotal: number, area: number | null): number | null {
  if (area == null || area <= 0) return null;
  if (!Number.isFinite(subtotal)) return null;
  return subtotal / area;
}

/**
 * Làm tròn đơn giá về bội số của `step` (mặc định 1.000 đ — báo giá mẫu ghi 695.000,
 * không ai ghi 694.983).
 */
export function roundUnitPrice(v: number | null, step = 1000): number | null {
  if (v == null) return null;
  if (step <= 1) return roundVnd(v);
  return Math.round(v / step) * step;
}

/** Bỏ dấu cách và không phân biệt hoa thường khi so mã phần. */
const chuanHoaMa = (s: string) => s.trim().toUpperCase();

export interface DeriveResult {
  lines: DerivedLine[];
  warnings: string[];
}

/**
 * Dựng danh sách dòng hạng mục từ khuôn + số liệu báo giá chi tiết.
 *
 * Mọi trường hợp không suy ra được đều để trống đơn giá VÀ kèm một cảnh báo — dòng
 * đó vẫn xuất hiện để người dùng tự điền, chứ không bị âm thầm bỏ đi.
 */
export function deriveLines(
  specs: DeriveSpec[],
  sections: SourceSection[],
  /** Tổng tiền bán của từng phần, khóa theo id (xem sectionSubtotals ở lib/quote). */
  subtotals: Map<string, number>,
  /** Diện tích dự phòng khi phần không khai diện tích — thường là Project.area. */
  fallbackArea: number | null,
  step = 1000
): DeriveResult {
  const theoMa = new Map(sections.map((s) => [chuanHoaMa(s.code), s]));
  const warnings: string[] = [];
  const lines: DerivedLine[] = [];

  for (const sp of specs) {
    const chung = {
      partCode: sp.partCode,
      partName: sp.partName,
      code: sp.code,
      name: sp.name,
      detail: sp.detail,
      unit: sp.unit,
      note: sp.note,
      amount: null as null,
    };

    // Dòng không gắn phần nào -> luôn nhập tay, dùng đơn giá mặc định của mẫu.
    if (!sp.sourceSectionCode) {
      lines.push({ ...chung, qty: null, unitPrice: sp.defaultUnitPrice, sourceSectionId: null });
      continue;
    }

    const sec = theoMa.get(chuanHoaMa(sp.sourceSectionCode));
    if (!sec) {
      warnings.push(
        `Không tìm thấy phần "${sp.sourceSectionCode}" trong báo giá chi tiết — dòng "${sp.name}" để trống đơn giá.`
      );
      lines.push({ ...chung, qty: null, unitPrice: sp.defaultUnitPrice, sourceSectionId: null });
      continue;
    }

    const area = sec.area ?? fallbackArea;
    const subtotal = subtotals.get(sec.id) ?? 0;

    if (area == null || area <= 0) {
      warnings.push(
        `Phần "${sec.code}" chưa có diện tích (và dự án cũng chưa khai) — dòng "${sp.name}" để trống đơn giá.`
      );
      lines.push({ ...chung, qty: null, unitPrice: null, sourceSectionId: sec.id });
      continue;
    }

    if (subtotal === 0) {
      warnings.push(
        `Phần "${sec.code}" chưa có đơn giá bán trong báo giá chi tiết — đơn giá dòng "${sp.name}" bằng 0.`
      );
    }

    lines.push({
      ...chung,
      qty: area,
      unitPrice: roundUnitPrice(unitPriceFromSection(subtotal, area), step),
      sourceSectionId: sec.id,
    });
  }

  return { lines, warnings };
}

/** Dòng đang có trong báo giá, dùng khi tính lại đơn giá. */
export interface ExistingLine {
  id: string;
  sourceSectionId: string | null;
  priceOverridden: boolean;
}

export interface Reprice {
  id: string;
  qty: number | null;
  unitPrice: number | null;
}

export interface RepriceResult {
  updates: Reprice[];
  skipped: number;
  warnings: string[];
}

/**
 * Tính lại đơn giá cho các dòng đã sinh tự động.
 *
 * Dòng có cờ `priceOverridden` được GIỮ NGUYÊN — người dùng đã sửa tay thì công sức
 * đó không được ghi đè. Dòng không gắn phần nào cũng bỏ qua.
 */
export function repriceLines(
  existing: ExistingLine[],
  sections: SourceSection[],
  subtotals: Map<string, number>,
  fallbackArea: number | null,
  step = 1000
): RepriceResult {
  const theoId = new Map(sections.map((s) => [s.id, s]));
  const updates: Reprice[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const l of existing) {
    if (l.sourceSectionId == null) continue;
    if (l.priceOverridden) {
      skipped++;
      continue;
    }
    const sec = theoId.get(l.sourceSectionId);
    if (!sec) {
      warnings.push("Một dòng trỏ tới phần đã bị xóa khỏi báo giá chi tiết — bỏ qua.");
      continue;
    }
    const area = sec.area ?? fallbackArea;
    if (area == null || area <= 0) {
      warnings.push(`Phần "${sec.code}" chưa có diện tích — không tính lại được đơn giá.`);
      continue;
    }
    updates.push({
      id: l.id,
      qty: area,
      unitPrice: roundUnitPrice(unitPriceFromSection(subtotals.get(sec.id) ?? 0, area), step),
    });
  }

  return { updates, skipped, warnings };
}
