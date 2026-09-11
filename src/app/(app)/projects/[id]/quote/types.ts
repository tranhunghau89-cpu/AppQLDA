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
  clonedFromTitle: string | null;
  sections: SectionView[];
  items: ItemView[];
}

export interface CatalogOption {
  code: string;
  name: string;
  unit: string | null;
  baseCost: number | null;
}

export interface CloneSource {
  id: string;
  label: string;
}
