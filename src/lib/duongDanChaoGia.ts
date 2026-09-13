/**
 * Trang này có phải trang CHÀO GIÁ không — dự toán chào giá hoặc báo giá gửi khách.
 *
 * Hai trang đó mang đường dẫn của chủ sở hữu (`/projects/<id>/quote`,
 * `/co-hoi/<id>/client-quote`) vì mỗi bản thuộc về một dự án hay một cơ hội. Nhưng về
 * nhịp làm việc chúng là việc BÁN HÀNG, nằm dưới mục "Chào giá"; mục "Dự án" chỉ giữ
 * những gì của thi công, như dự toán thi công. Menu không được đọc tiền tố `/projects`
 * rồi sáng nhầm mục "Dự án".
 *
 * Giữ nguyên đường dẫn cũ chứ không dời trang: dời là gãy mọi liên kết, bookmark và
 * đường quay về từ trang in.
 */
export function laTrangChaoGia(pathname: string): boolean {
  return /^\/(projects|co-hoi)\/[^/]+\/(quote|client-quote)(\/|$)/.test(pathname);
}
