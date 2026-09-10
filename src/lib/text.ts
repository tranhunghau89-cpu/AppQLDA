// Chuẩn hóa chuỗi để SO KHỚP (tên dự án, tên NCC...) — dùng chung cho công nợ và
// nhập Excel. Trước đây mỗi nơi tự viết một bản; nếu chúng lệch nhau thì việc khớp
// tên ở hai chỗ sẽ ra kết quả khác nhau, rất khó lần ra.

/** Bỏ dấu, đ→d, chỉ giữ chữ thường và số. "Cty Thép Đại Việt" -> "ctythepdaiviet" */
export function norm(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
