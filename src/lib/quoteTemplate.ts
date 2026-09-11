// Thư viện mẫu báo giá gửi khách: chọn mẫu theo loại công trình, và nấu một mẫu
// (hoặc không có mẫu nào) thành bộ giá trị rót vào báo giá mới.
//
// Toàn bộ file này là logic thuần — không đụng Prisma — để test được và để dùng
// được ở cả phía server lẫn phía trình duyệt.

import { norm } from "./text";
import {
  DEFAULT_CLOSING,
  DEFAULT_COLOR_NOTE,
  DEFAULT_EXCLUDE_NOTE,
  DEFAULT_GREETING,
  DEFAULT_LINE_DETAIL,
  DEFAULT_LOADS,
  DEFAULT_MAINTENANCE_MONTHS,
  DEFAULT_PAYMENTS,
  DEFAULT_SPECS,
  DEFAULT_STAGES,
  DEFAULT_VALID_DAYS,
  DEFAULT_VAT_PERCENT,
  DEFAULT_VOLUME_NOTE,
  DEFAULT_WARRANTY_MONTHS,
  type PaymentSeed,
  type SpecSeed,
  type StageSeed,
} from "./clientQuoteDefaults";

/* ------------------------------------------------------------------ *
 * Chọn mẫu theo loại công trình
 * ------------------------------------------------------------------ */

/** Vừa đủ để chọn — nhận cả bản ghi Prisma đầy đủ lẫn bản rút gọn cho client. */
export interface TemplateLike {
  buildingType: string | null;
  sortOrder: number;
}

/**
 * Mẫu phù hợp nhất cho một loại công trình.
 *
 * Thứ tự ưu tiên:
 *   1. Trùng nguyên văn (đã trim) — người soạn gõ đúng y như Project.buildingType.
 *   2. Trùng sau khi bỏ dấu / hoa thường / ký tự lạ ("Nhà xưởng" = "nha xuong").
 *   3. Mẫu không khai loại công trình — mẫu dùng chung, hợp với mọi dự án.
 * Trong cùng một bậc thì `sortOrder` nhỏ hơn thắng; không có gì hợp thì trả null.
 *
 * KHÔNG so khớp một phần (startsWith/includes): "Nhà xưởng" và "Nhà xưởng 2 tầng"
 * là hai loại công trình khác nhau, khớp nhầm thì báo giá gửi khách sai điều khoản.
 */
export function matchTemplate<T extends TemplateLike>(
  templates: T[],
  buildingType: string | null | undefined
): T | null {
  if (templates.length === 0) return null;
  const theoThuTu = [...templates].sort((a, b) => a.sortOrder - b.sortOrder);

  const can = typeof buildingType === "string" ? buildingType.trim() : "";
  if (can) {
    const nguyenVan = theoThuTu.find((t) => (t.buildingType ?? "").trim() === can);
    if (nguyenVan) return nguyenVan;

    const boDau = norm(can);
    // norm("") rỗng — mẫu không khai loại công trình không được lọt vào bậc này,
    // nếu không nó sẽ ăn mất bậc 2 của một loại công trình chỉ gồm ký tự lạ.
    if (boDau) {
      const gan = theoThuTu.find((t) => t.buildingType && norm(t.buildingType) === boDau);
      if (gan) return gan;
    }
  }

  return theoThuTu.find((t) => !t.buildingType?.trim()) ?? null;
}

/* ------------------------------------------------------------------ *
 * Nấu mẫu thành giá trị rót vào báo giá mới
 * ------------------------------------------------------------------ */

/** Một dòng hạng mục trong mẫu — giống ClientQuoteLine, trừ số liệu của dự án. */
export interface LineSeed {
  partCode: string;
  partName: string;
  code: string | null;
  name: string;
  detail: string | null;
  unit: string | null;
  note: string | null;
  defaultUnitPrice: number | null;
  tags: string[];
  sourceSectionCode: string | null;
  steelFrameKey: string | null;
}

/** Hình dạng một mẫu — khớp bản ghi QuoteTemplate kèm 4 bảng con. */
export interface MauNguon {
  vatPercent: number | null;
  validDays: number | null;
  warrantyMonths: number | null;
  maintenanceMonths: number | null;
  loadRoof: number | null;
  loadHanging: number | null;
  loadFloor: number | null;
  lineDetail: string | null;
  greeting: string | null;
  closing: string | null;
  colorNote: string | null;
  volumeNote: string | null;
  excludeNote: string | null;
  lines: LineSeed[];
  specs: SpecSeed[];
  stages: StageSeed[];
  payments: PaymentSeed[];
}

/** Bộ giá trị đã chốt, không còn chỗ nào null vì "chưa biết lấy ở đâu". */
export interface KhuonBaoGia {
  vatPercent: number;
  validDays: number;
  warrantyMonths: number;
  maintenanceMonths: number;
  loadRoof: number;
  loadHanging: number;
  loadFloor: number;
  lineDetail: string;
  greeting: string;
  closing: string;
  colorNote: string;
  volumeNote: string;
  excludeNote: string;
  lines: LineSeed[];
  specs: SpecSeed[];
  stages: StageSeed[];
  payments: PaymentSeed[];
}

/**
 * Giá trị rót vào một báo giá mới: lấy của mẫu, thiếu thì lấy mặc định trong
 * `clientQuoteDefaults`. Không chọn mẫu (`null`) thì toàn bộ là mặc định.
 *
 * Hai điều cố ý:
 *
 * - Dùng `??` chứ không `||`, nên `vatPercent: 0` (hàng không chịu thuế) được tôn
 *   trọng. Muốn "không VAT" thì đặt 0, để trống nghĩa là "theo mặc định 10%".
 * - Bốn bảng con chỉ lấy mặc định khi KHÔNG có mẫu. Mẫu có mà bảng con rỗng thì
 *   giữ rỗng — người soạn mẫu đã cố ý xóa hết, rót 16 dòng vật liệu mặc định vào
 *   là làm sống lại thứ họ vừa bỏ. Mẫu tạo mới được rót sẵn từ mặc định nên chuyện
 *   "rỗng do lỡ tay" không xảy ra.
 */
export function apDungMau(t: MauNguon | null): KhuonBaoGia {
  return {
    vatPercent: t?.vatPercent ?? DEFAULT_VAT_PERCENT,
    validDays: t?.validDays ?? DEFAULT_VALID_DAYS,
    warrantyMonths: t?.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
    maintenanceMonths: t?.maintenanceMonths ?? DEFAULT_MAINTENANCE_MONTHS,
    loadRoof: t?.loadRoof ?? DEFAULT_LOADS.roof,
    loadHanging: t?.loadHanging ?? DEFAULT_LOADS.hanging,
    loadFloor: t?.loadFloor ?? DEFAULT_LOADS.floor,
    lineDetail: t?.lineDetail ?? DEFAULT_LINE_DETAIL,
    greeting: t?.greeting ?? DEFAULT_GREETING,
    closing: t?.closing ?? DEFAULT_CLOSING,
    colorNote: t?.colorNote ?? DEFAULT_COLOR_NOTE,
    volumeNote: t?.volumeNote ?? DEFAULT_VOLUME_NOTE,
    excludeNote: t?.excludeNote ?? DEFAULT_EXCLUDE_NOTE,
    lines: t ? t.lines : [],
    specs: t ? t.specs : DEFAULT_SPECS,
    stages: t ? t.stages : DEFAULT_STAGES,
    payments: t ? t.payments : DEFAULT_PAYMENTS,
  };
}

/** Mẫu rỗng dựng từ mặc định — dùng khi tạo một mẫu mới trong thư viện. */
export function mauMacDinh(): KhuonBaoGia {
  return apDungMau(null);
}
