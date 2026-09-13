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

/**
 * Phần quy cách còn ĐÁNG HIỆN sau tên — `null` nếu tên đã nói đủ.
 *
 * Thư viện hiện "tên · quy cách", nhưng cả 81/81 công tác có quy cách đều đã chép sẵn
 * quy cách ấy vào cuối tên: "Bulong neo M30 dài 900, CT34, xi kẽm ren · CT34, xi kẽm
 * ren". Lặp như vậy làm dòng bảng xuống hai hàng mà không thêm chữ nào mới.
 *
 * So bằng `norm` để khoảng trắng, dấu phẩy, hoa thường không làm lệch. Quy cách thật sự
 * bổ sung thông tin — không nằm trong tên — thì vẫn hiện như cũ.
 *
 * Cái giá của `norm`: nó bỏ MỌI dấu câu, nên "4,5mm" và "45mm" thành cùng một chuỗi.
 * Chấp nhận được vì hàm này chỉ quyết định HIỆN hay ẩn một dòng chữ xám — không bao giờ
 * dùng để so dữ liệu hay tính tiền. Đoán sai thì tệ nhất là mất một dòng chữ lặp.
 */
export function quyCachBoSung(
  ten: string | null | undefined,
  quyCach: string | null | undefined
): string | null {
  const qc = quyCach?.trim();
  if (!qc) return null;
  const n = norm(qc);
  if (!n) return null;
  return norm(ten).includes(n) ? null : qc;
}
