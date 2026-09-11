// Hình dạng dữ liệu của trình soạn mẫu báo giá.
//
// Mọi ô số giữ dạng CHUỖI trong khi soạn (`parseViNumber` lúc lưu) — giống trình
// soạn mẫu dự toán: gõ dở "1.2" hay xóa trắng ô không được biến thành NaN hay 0.

/** Dữ liệu server nạp xuống, đã phẳng hóa. */
export interface EditorTemplate {
  id: string;
  name: string;
  buildingType: string | null;
  description: string | null;
  active: boolean;
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
  lines: EditorLine[];
  specs: EditorSpec[];
  stages: EditorStage[];
  payments: EditorPayment[];
}

export interface EditorLine {
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
export interface EditorSpec {
  groupCode: string;
  tag: string | null;
  name: string;
  spec: string | null;
  origin: string | null;
}
export interface EditorStage {
  name: string;
  days: number | null;
}
export interface EditorPayment {
  label: string;
  percent: number | null;
  basis: string | null;
  note: string | null;
}

/* --- trạng thái trong trình soạn: cùng các trường nhưng toàn chuỗi + uid --- */

export interface LineRow {
  uid: string;
  partCode: string;
  partName: string;
  code: string;
  name: string;
  detail: string;
  unit: string;
  note: string;
  price: string;
  tags: string[];
  sourceSectionCode: string;
  steelFrameKey: string;
}
export interface SpecRow {
  uid: string;
  groupCode: string;
  tag: string;
  name: string;
  spec: string;
  origin: string;
}
export interface StageRow {
  uid: string;
  name: string;
  days: string;
}
export interface PaymentRow {
  uid: string;
  label: string;
  percent: string;
  basis: string;
  note: string;
}

/** null/undefined -> "" để đổ thẳng vào ô nhập. */
export const s = (v: string | number | null | undefined): string =>
  v == null ? "" : String(v);
