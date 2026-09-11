// Lọc danh sách báo giá theo GIAI ĐOẠN: còn đang chào, hay đã thành dự án.
//
// Từ Phase 8.3–8.4 hai trang danh sách trộn chung cả hai — người bán hàng muốn thấy
// việc của mình, kế toán muốn thấy việc đã ký. Một cột `coHoiId`/`projectId` đã phân
// biệt sẵn, chỉ cần dịch nó thành mệnh đề lọc.
//
// Logic thuần; nơi gọi ghép vào truy vấn.

export type GiaiDoan = "TAT_CA" | "CHAO_GIA" | "DU_AN";

export const GIAI_DOAN: { value: GiaiDoan; label: string }[] = [
  { value: "TAT_CA", label: "Tất cả" },
  { value: "CHAO_GIA", label: "Đang chào giá" },
  { value: "DU_AN", label: "Đã ký / dự án" },
];

/**
 * Đọc giá trị từ thanh địa chỉ. Giá trị lạ rơi về "Tất cả" chứ không báo lỗi — tham số
 * URL ai gõ cũng được, và hiện thừa vẫn tốt hơn hiện một trang trắng.
 */
export function docGiaiDoan(v: string | string[] | undefined): GiaiDoan {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "CHAO_GIA" || s === "DU_AN" ? s : "TAT_CA";
}

/** Mệnh đề lọc theo giai đoạn. "Tất cả" là mệnh đề rỗng — KHÔNG được `OR` với nó. */
export function whereGiaiDoan(g: GiaiDoan): Record<string, unknown> {
  if (g === "CHAO_GIA") return { coHoiId: { not: null } };
  if (g === "DU_AN") return { projectId: { not: null } };
  return {};
}

/**
 * Ghép mệnh đề phạm vi (ai được xem gì) với mệnh đề giai đoạn (muốn xem gì).
 *
 * Phải ghép bằng AND ở cấp cao nhất, và tuyệt đối không đụng vào mệnh đề phạm vi. Trải
 * hai đối tượng vào nhau chỉ an toàn khi chúng không trùng khóa — phạm vi dùng `OR`,
 * giai đoạn dùng `coHoiId`/`projectId` — nhưng "an toàn vì tình cờ không trùng" là thứ
 * hỏng lặng lẽ lúc ai đó đổi một trong hai. Nên dùng `AND` tường minh.
 */
export function ghepLoc(
  pham: Record<string, unknown>,
  g: GiaiDoan
): Record<string, unknown> {
  const gd = whereGiaiDoan(g);
  if (Object.keys(gd).length === 0) return pham;
  if (Object.keys(pham).length === 0) return gd;
  return { AND: [pham, gd] };
}
