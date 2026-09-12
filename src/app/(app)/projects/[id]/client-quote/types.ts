import type { NoteView } from "@/components/crm/InteractionLog";

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

/**
 * Giá vốn của một PHẦN trong bản dự toán chi tiết đã sinh ra bản gửi khách.
 *
 * Gom theo phần chứ không nhét vào từng dòng gửi khách: nhiều dòng có thể cùng trỏ về
 * một phần, và chép bảng chi tiết vào mỗi dòng là gửi cùng một dữ liệu xuống trình
 * duyệt mấy lần.
 */
export interface GiaVonPhan {
  sectionId: string;
  ma: string;
  ten: string;
  dienTich: number | null;
  tongGiaVon: number;
  /** Đơn giá vốn trên m²; null khi phần chưa khai diện tích. */
  giaVonM2: number | null;
  dong: {
    ten: string;
    donVi: string | null;
    qty: number | null;
    donGia: number | null;
    thanhTien: number;
  }[];
}

export interface SpecView {
  id: string;
  groupCode: string; // A | B
  tag: string | null;
  name: string;
  spec: string | null;
  origin: string | null;
  /** Có nhắc lại dòng này trong mô tả dưới tên hạng mục không. */
  inDescription: boolean;
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
  /** Giá vốn từng phần của bản dự toán nguồn — chỉ người trong nhà thấy, không in. */
  giaVon: GiaVonPhan[];
  clonedFromTitle: string | null;
  lines: LineView[];
  specs: SpecView[];
  stages: StageView[];
  payments: PaymentView[];
  /** Nhật ký trao đổi của riêng báo giá này (rỗng khi không có quyền xem CĐT). */
  contacts: NoteView[];
}

export type { NoteView } from "@/components/crm/InteractionLog";

export interface CustomerOption {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
}
