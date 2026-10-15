// Nhãn phiếu bảo hành dùng chung client/server — tách khỏi baoHanh.ts (file đó đụng Prisma).
export const TRANG_THAI_BAO_HANH: Record<string, { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }> = {
  MOI: { label: "Mới, chưa giao", tone: "amber" },
  DANG_XU_LY: { label: "Đang xử lý", tone: "blue" },
  DA_XONG: { label: "Đã xong", tone: "green" },
  TU_CHOI: { label: "Từ chối", tone: "slate" },
};

/** Phiếu còn mở (chưa xong, chưa từ chối). */
export const BAO_HANH_MO = ["MOI", "DANG_XU_LY"];
