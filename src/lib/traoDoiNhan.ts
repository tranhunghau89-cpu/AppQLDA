// Nhãn dùng chung cho cả client và server — tách khỏi traoDoi.ts (file đó đụng Prisma).
export const LOAI_TRAO_DOI_LABEL: Record<string, string> = {
  GHI_CHU: "Ghi chú",
  XIN_DUYET: "Xin duyệt",
  CAN_SUA: "Cần chỉnh sửa",
  DONG_Y: "Đồng ý",
};
