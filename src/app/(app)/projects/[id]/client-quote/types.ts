// Hình dạng dữ liệu báo giá gửi khách sau khi server component đã chuẩn hóa
// (Date -> chuỗi ISO) để đưa xuống client component.

export interface LineView {
  id: string;
  partCode: string;
  partName: string;
  code: string | null;
  name: string;
  detail: string | null;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  note: string | null;
  tags: string[];
  sourceSectionId: string | null;
  priceOverridden: boolean;
  steelFrameKey: string | null;
}

export interface SpecView {
  id: string;
  groupCode: string; // A | B
  tag: string | null;
  name: string;
  spec: string | null;
  origin: string | null;
}

export interface StageView {
  id: string;
  name: string;
  days: number | null;
}

export interface PaymentView {
  id: string;
  label: string;
  percent: number | null;
  basis: string | null;
  note: string | null;
}

export interface ClientQuoteView {
  id: string;
  quoteNo: string | null;
  title: string;
  quoteDate: string | null;
  customerId: string | null;
  recipient: string | null;
  customerPhone: string | null;
  location: string | null;
  scope: string | null;
  salesName: string | null;
  salesPhone: string | null;
  salesEmail: string | null;
  status: string;
  sentDate: string | null;
  validDays: number | null;
  expiryDate: string | null;
  vatPercent: number | null;
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
  note: string | null;
  derivedFromTitle: string | null;
  clonedFromTitle: string | null;
  lines: LineView[];
  specs: SpecView[];
  stages: StageView[];
  payments: PaymentView[];
}

export interface CustomerOption {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}
