// Chủ sở hữu của một bản dự toán chi tiết.
//
// Từ Phase 8.3, dự toán sống được ở hai nơi: cơ hội chào giá (chưa có hợp đồng) và dự
// án (đã ký). Chủ sở hữu quyết định AI ĐƯỢC XEM/SỬA nó, nên mọi phép so khớp chủ phải
// nằm ở một chỗ duy nhất và có test — chứ không rải `q.projectId !== projectId` khắp
// nơi như trước.
//
// Logic thuần, không đụng Prisma. Phần tra cứu quyền thật nằm ở `coHoiAccess.ts`.

/** Nơi một bản dự toán đang thuộc về. */
export type ChuBaoGia = { loai: "DU_AN"; id: string } | { loai: "CO_HOI"; id: string };

/** Vừa đủ hai cột chủ sở hữu của một dòng Quote. */
export interface QuoteCoChu {
  projectId: string | null;
  coHoiId: string | null;
}

/**
 * Đọc chủ sở hữu từ một dòng Quote.
 *
 * Dự án thắng khi cả hai cùng có giá trị. Đúng luật thì chuyện đó không xảy ra
 * (`chuHopLe` bên dưới), nhưng nếu dữ liệu có lỗi thì bên chặt hơn phải thắng: phạm vi
 * dự án đi qua `ProjectMember`, còn phạm vi cơ hội cho cả khách chưa phân công.
 */
export function chuCuaQuote(q: QuoteCoChu): ChuBaoGia | null {
  if (q.projectId) return { loai: "DU_AN", id: q.projectId };
  if (q.coHoiId) return { loai: "CO_HOI", id: q.coHoiId };
  return null;
}

/** Đúng một trong hai cột được điền. Dùng để chốt bất biến trong test và lúc ghi. */
export function chuHopLe(q: QuoteCoChu): boolean {
  return Boolean(q.projectId) !== Boolean(q.coHoiId);
}

/** Hai cột để ghi khi tạo mới. Cột còn lại luôn null, không bao giờ bỏ trống. */
export function duLieuChu(chu: ChuBaoGia): { projectId: string | null; coHoiId: string | null } {
  return chu.loai === "DU_AN"
    ? { projectId: chu.id, coHoiId: null }
    : { projectId: null, coHoiId: chu.id };
}

/**
 * Dòng Quote này có đúng là của chủ đang thao tác không.
 *
 * Đây là phép kiểm chống ghi chéo: `quoteId` đến từ trình duyệt, `chu` đến từ URL, cả
 * hai đều sửa được. Hai chỗ dễ sai đã chặn sẵn: id rỗng không khớp gì cả (nếu không,
 * `"" === ""` cho qua), và chủ loại này KHÔNG bao giờ khớp cột của loại kia.
 */
export function laCungChu(chu: ChuBaoGia, q: QuoteCoChu): boolean {
  if (!chu.id) return false;
  return chu.loai === "DU_AN" ? q.projectId === chu.id : q.coHoiId === chu.id;
}

/** Mệnh đề `where` lấy đúng các dự toán của một chủ. */
export function whereCuaChu(chu: ChuBaoGia): { projectId: string } | { coHoiId: string } {
  return chu.loai === "DU_AN" ? { projectId: chu.id } : { coHoiId: chu.id };
}

/** Trang dự toán của chủ này. */
export function duongDanChu(chu: ChuBaoGia): string {
  return chu.loai === "DU_AN" ? `/projects/${chu.id}/quote` : `/co-hoi/${chu.id}/quote`;
}

/** Trang in một bản dự toán của chủ này. */
export function duongDanIn(chu: ChuBaoGia, quoteId: string): string {
  return `${duongDanChu(chu)}/${quoteId}/print`;
}
