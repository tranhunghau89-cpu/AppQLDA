// Phạm vi nhìn thấy của CRM.
//
// Khách chào giá chưa có dự án nào, nên KHÔNG dùng được `canAccessProject` như mọi thứ
// khác trong app. Quy tắc thay thế đi theo NGƯỜI PHỤ TRÁCH.
//
// Logic thuần, không đụng Prisma — trả về mệnh đề `where` để nơi gọi ghép vào truy vấn.
// Tách ra đây để test được đúng cái dễ sai nhất: ai nhìn thấy gì.

/** Vừa đủ để quyết định phạm vi. */
export interface AiDo {
  userId: string;
  role: string;
}

/**
 * Mệnh đề lọc khách hàng theo người đang xem.
 *
 * Ba bậc, cố ý:
 *   · Quản trị viên thấy tất cả — họ là người phân công.
 *   · Người khác thấy khách MÌNH phụ trách.
 *   · Cộng thêm khách CHƯA phân công ai. Một khách không ai nhìn thấy còn tệ hơn một
 *     khách hai người cùng thấy: nó nằm im tới lúc hết cơ hội mà không ai biết.
 *
 * Trả `{}` cho quản trị viên. Nơi gọi tuyệt đối KHÔNG được `OR` mệnh đề này với điều
 * kiện khác — `{}` sẽ nuốt mọi điều kiện còn lại và cho ra toàn bộ bảng. Cần gộp
 * nhiều nguồn thì dùng `whereBaoGiaTrongPhamVi` bên dưới.
 */
export function whereKhachHangTrongPhamVi(ai: AiDo): Record<string, unknown> {
  if (ai.role === "ADMIN") return {};
  return { OR: [{ ownerId: ai.userId }, { ownerId: null }] };
}

/** Người này có được đụng vào khách đó không (dùng sau khi đã đọc `ownerId`). */
export function duocDungKhachHang(ai: AiDo, ownerId: string | null): boolean {
  if (ai.role === "ADMIN") return true;
  return ownerId === null || ownerId === ai.userId;
}

/**
 * Mệnh đề lọc báo giá đến từ HAI nguồn: dự án được phân công, và khách mình phụ trách.
 *
 * Dùng cho `/quotes` và `/client-quotes` khi báo giá đã sống được ở cả hai nơi (Phase
 * 8.3–8.4). Ở đây trước để chỗ ghép hai nguồn chỉ có đúng một bản, và có test.
 *
 * `duAnTrongPhamVi = "ALL"` nghĩa là quản trị viên: trả `{}`, KHÔNG ghép thêm gì. Đây
 * chính là cái bẫy — `{ OR: [{}, …] }` khớp mọi dòng, và ai cũng thấy báo giá của tất
 * cả. Viết tường minh ở đây một lần để không ai phải nhớ nữa.
 */
export function whereBaoGiaTrongPhamVi(
  ai: AiDo,
  duAnTrongPhamVi: string[] | "ALL"
): Record<string, unknown> {
  if (ai.role === "ADMIN" || duAnTrongPhamVi === "ALL") return {};
  return {
    OR: [
      { projectId: { in: duAnTrongPhamVi } },
      { coHoi: { khachHang: { OR: [{ ownerId: ai.userId }, { ownerId: null }] } } },
    ],
  };
}
