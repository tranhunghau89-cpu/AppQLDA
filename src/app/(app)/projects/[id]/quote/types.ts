// Hình dạng dữ liệu báo giá chi tiết đã được server component chuẩn hóa
// (Date -> chuỗi ISO) trước khi đưa xuống các client component.

export interface SectionView {
  id: string;
  code: string;
  name: string;
  kind: string; // PHAN | SUB
  parentId: string | null;
  area: number | null;
}

export interface ItemView {
  id: string;
  sectionId: string;
  workCode: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  baseCost: number | null;
  sellPrice: number | null;
  spec: string | null;
  note: string | null;

  // ----- Đóng băng giá thư viện -----
  congTacId: string | null;
  congTacVatTuId: string | null;
  /** Tên biến thể vật liệu đã chốt, để hiện lên bảng. */
  bienTheTen: string | null;
  /** Giá thư viện lúc chốt; null = dòng gõ tay, không có gì để so. */
  donGiaThuVien: number | null;
  giaSuaTay: boolean;
  /** Đơn giá thư viện HIỆN HÀNH cho dòng này; null = thư viện không còn giá. */
  donGiaHienHanh: number | null;
  /** Thư viện đã đổi giá kể từ lúc chốt. TÍNH RA mỗi lần tải trang, không lưu. */
  coTroiGia: boolean;
}

export interface QuoteView {
  id: string;
  title: string;
  recipient: string | null;
  location: string | null;
  scope: string | null;
  quoteDate: string | null;
  markup: number | null;
  note: string | null;
  /** Khu vực dùng để tra đơn giá cho bản này. */
  khuVucId: string | null;
  khuVucTen: string | null;
  clonedFromTitle: string | null;
  sections: SectionView[];
  items: ItemView[];
}

export interface CatalogOption {
  /** Mã công tác — vẫn là thứ QuoteItem.workCode lưu lại. */
  code: string;
  congTacId: string;
  name: string;
  unit: string | null;
  /**
   * Đơn giá CHUNG hiện hành. Giá theo khu vực và biến thể phải hỏi server qua
   * `goiYDonGia`: nó phụ thuộc vào khu vực của từng bản dự toán, mà một trang có
   * thể liệt kê nhiều bản với khu vực khác nhau.
   */
  baseCost: number | null;
  bienThe: { id: string; ten: string; laMacDinh: boolean }[];
}

export interface CloneSource {
  id: string;
  label: string;
}
