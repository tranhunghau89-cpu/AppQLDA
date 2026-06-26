// Hằng số miền (domain) — ánh xạ từ Excel. Dùng chung server + client.

type Tone = "slate" | "blue" | "amber" | "green" | "red" | "purple";

export interface Option {
  value: string;
  label: string;
  tone?: Tone;
}

function map(opts: Option[]): Record<string, Option> {
  return Object.fromEntries(opts.map((o) => [o.value, o]));
}

// ----- Trạng thái dự án (cột B "Tình Trạng" ở TongHop) -----
export const PROJECT_STATUS: Option[] = [
  { value: "CHO", label: "Chờ", tone: "slate" },
  { value: "SHOP", label: "Shop", tone: "purple" },
  { value: "GIA_CONG", label: "Gia công", tone: "amber" },
  { value: "LAP_DUNG", label: "Lắp dựng", tone: "blue" },
  { value: "HOAN_THANH", label: "Hoàn thành", tone: "green" },
];
export const PROJECT_STATUS_MAP = map(PROJECT_STATUS);

// ----- Loại nhà cung cấp (cột I–N) -----
export const SUPPLIER_CATEGORY: Option[] = [
  { value: "KCT", label: "Kết cấu thép" },
  { value: "XA_GO", label: "Xà gồ" },
  { value: "TON", label: "Tôn" },
  { value: "BL_NEO", label: "Bulong neo" },
  { value: "BLLK", label: "Bulong liên kết" },
  { value: "LAP_DUNG", label: "Lắp dựng" },
  { value: "KHAC", label: "Khác" },
];
export const SUPPLIER_CATEGORY_MAP = map(SUPPLIER_CATEGORY);

// ----- Hạng mục NCC trên dự án (component ProjectSupplier) -----
export const PROJECT_COMPONENT: Option[] = [
  { value: "BL_NEO", label: "BL neo" },
  { value: "KCT", label: "KCT" },
  { value: "XA_GO", label: "Xà gồ" },
  { value: "BLLK", label: "BLLK" },
  { value: "TON", label: "Tôn" },
  { value: "LAP_DUNG", label: "Lắp dựng" },
];
export const PROJECT_COMPONENT_MAP = map(PROJECT_COMPONENT);

// ----- Mốc tiến độ (mục II sheet Nxxx) -----
export const MILESTONE_TYPE: Option[] = [
  { value: "BV_KT", label: "Bản vẽ KT" },
  { value: "SHOP", label: "Shop" },
  { value: "MUA_HANG", label: "Mua hàng" },
  { value: "GIA_CONG", label: "Gia công" },
  { value: "LAP_DUNG", label: "Lắp dựng" },
  { value: "LOP_TON", label: "Lợp tôn" },
  { value: "HS_NT", label: "HS nghiệm thu" },
  { value: "HS_QT", label: "HS quyết toán" },
];
export const MILESTONE_TYPE_MAP = map(MILESTONE_TYPE);

// ----- Nhóm dự toán (mục IV sheet Nxxx) -----
// isCost = tính vào tổng chi phí để ra lợi nhuận.
export const ESTIMATE_GROUP: Option[] = [
  { value: "KCT", label: "Kết cấu thép" },
  { value: "XA_GO", label: "Xà gồ" },
  { value: "TON", label: "Tôn - Diềm" },
  { value: "BL_NEO", label: "Bulong neo" },
  { value: "BLLK", label: "BLLK" },
  { value: "VT_PHU", label: "Vật tư phụ" },
  { value: "NHAN_CONG", label: "Nhân công" },
  { value: "VAN_CHUYEN", label: "Vận chuyển" },
  { value: "MAY", label: "Máy" },
  { value: "KHAC", label: "Khác" },
];
export const ESTIMATE_GROUP_MAP = map(ESTIMATE_GROUP);

// ----- Nhóm hạng mục Tổng hợp chi phí (A–K) → map ESTIMATE_GROUP -----
export interface CostCategoryDef {
  code: string; // A..K
  label: string;
  group: string; // ESTIMATE_GROUP value
}
export const COST_CATEGORY: CostCategoryDef[] = [
  { code: "A", label: "Kết cấu thép", group: "KCT" },
  { code: "B", label: "Xà gồ", group: "XA_GO" },
  { code: "C", label: "Tôn - Diềm", group: "TON" },
  { code: "D", label: "Bulong neo", group: "BL_NEO" },
  { code: "E", label: "BLLK", group: "BLLK" },
  { code: "F", label: "Vật tư phụ", group: "VT_PHU" },
  { code: "G", label: "Lắp dựng", group: "NHAN_CONG" },
  { code: "H", label: "Vận chuyển", group: "VAN_CHUYEN" },
  { code: "I", label: "Máy", group: "MAY" },
  { code: "K", label: "Khác", group: "KHAC" },
];
export const COST_CATEGORY_MAP: Record<string, CostCategoryDef> = Object.fromEntries(
  COST_CATEGORY.map((c) => [c.code, c])
);

// ----- Trạng thái hợp đồng / báo giá -----
export const CONTRACT_STATUS: Option[] = [
  { value: "QUOTE", label: "Báo giá", tone: "slate" },
  { value: "SIGNED", label: "Đã ký", tone: "green" },
  { value: "LIQUIDATED", label: "Thanh lý", tone: "blue" },
];
export const CONTRACT_STATUS_MAP = map(CONTRACT_STATUS);

// ----- Đơn đặt hàng (mua hàng) -----
export const PO_CATEGORY: Option[] = [
  { value: "BL", label: "Bulong & liên kết", tone: "amber" },
  { value: "TON", label: "Tôn & bao che", tone: "blue" },
  { value: "PANEL", label: "Panel", tone: "purple" },
  { value: "CUALUA", label: "Cửa lùa", tone: "slate" },
  { value: "PK", label: "Phụ kiện", tone: "slate" },
  { value: "KHAC", label: "Khác", tone: "slate" },
];
export const PO_CATEGORY_MAP = map(PO_CATEGORY);

export const PO_STATUS: Option[] = [
  { value: "DRAFT", label: "Nháp", tone: "slate" },
  { value: "ORDERED", label: "Đã đặt", tone: "amber" },
  { value: "RECEIVED", label: "Đã nhận", tone: "green" },
];
export const PO_STATUS_MAP = map(PO_STATUS);

// ----- Nhóm mã công việc trong catalog đơn giá (2 ký tự đầu Mã CV) -----
export const WORK_GROUP: Option[] = [
  { value: "AA", label: "Kết cấu thép" },
  { value: "AB", label: "Bulong neo & mã dưỡng" },
  { value: "AC", label: "Bulong & phụ kiện liên kết" },
  { value: "AD", label: "Tôn & diềm" },
  { value: "AE", label: "Phụ kiện tôn" },
  { value: "AF", label: "Sàn decking" },
  { value: "AG", label: "Vận chuyển" },
  { value: "AK", label: "Lắp dựng" },
  { value: "AL", label: "Gia công khác" },
];
export const WORK_GROUP_MAP = map(WORK_GROUP);

/** Lấy nhóm AA..AL từ Mã CV (vd "AC.150" -> "AC"); fallback "AL". */
export function workGroupOf(code: string | null | undefined): string {
  if (!code) return "AL";
  const g = code.trim().slice(0, 2).toUpperCase();
  return g in WORK_GROUP_MAP ? g : "AL";
}

export function labelOf(
  map: Record<string, Option>,
  value: string | null | undefined
): string {
  if (!value) return "—";
  return map[value]?.label ?? value;
}
