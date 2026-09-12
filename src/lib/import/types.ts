// Khung chung cho việc nhập Excel qua web.
//
// Luồng: upload -> parse (CHỈ đọc, không đụng DB) -> xem trước -> xác nhận -> apply.
// Việc tách parse khỏi apply là điểm mấu chốt: người dùng thấy trước hệ thống hiểu
// file thế nào rồi mới quyết định ghi, thay vì chạy script CLI rồi mới biết sai.
import "server-only";

export const IMPORT_KIND = {
  estimate: "Dự toán chi tiết",
  thcp: "Tổng hợp chi phí (quyết toán)",
  order: "Đơn đặt hàng vật tư",
  thuVien: "Thư viện đơn giá (sheet DV)",
} as const;

export type ImportKind = keyof typeof IMPORT_KIND;

/** Mô tả cách file được khớp vào một dự án. */
export interface ProjectMatch {
  /** null = sẽ tạo dự án mới khi xác nhận. */
  projectId: string | null;
  code: string | null;
  name: string;
  /** Giải thích cho người dùng vì sao khớp vào đây. */
  cachKhop: string;
  taoMoi: boolean;
}

export interface PreviewStat {
  nhan: string;
  giaTri: string;
}

/** Một dòng trong bảng xem trước — cố ý để dạng chuỗi cho dễ hiển thị. */
export interface PreviewRow {
  cot: string[];
}

export interface ImportPreview {
  kind: ImportKind;
  fileName: string;
  /**
   * Dự án đích. Vắng mặt khi file KHÔNG thuộc dự án nào — thư viện đơn giá là dữ liệu
   * toàn cục. Thà để trống còn hơn bịa một dự án giả chỉ để lấp chỗ: giao diện sẽ hiện
   * một ô "Dự án đích" nói dối.
   */
  duAn?: ProjectMatch;
  /** Số liệu tổng hợp hiện lên đầu (diện tích, tổng chi phí, số dòng...). */
  thongKe: PreviewStat[];
  /** Cảnh báo — không chặn, nhưng người dùng nên đọc trước khi xác nhận. */
  canhBao: string[];
  tieuDeCot: string[];
  /** Chỉ vài dòng đầu để xem; số thật nằm ở `tongSoDong`. */
  dongMau: PreviewRow[];
  tongSoDong: number;
  /**
   * Dữ liệu đã bóc, gửi xuống client rồi gửi ngược lên khi xác nhận.
   * Server VẪN validate lại bằng zod trước khi ghi — không tin dữ liệu quay về.
   *
   * `null` = xem trước được nhưng KHÔNG ghi được (ví dụ đơn hàng không khớp dự án
   * nào); giao diện sẽ khóa nút xác nhận.
   */
  payload: unknown;

  /**
   * Bước xác nhận phải GỬI LẠI file gốc, server bóc lại từ đầu thay vì tin payload.
   *
   * Dùng cho file có dữ liệu nhị phân nhúng (ảnh biên dạng trong đơn hàng): gửi vòng
   * qua client rồi gửi ngược lên là vượt giới hạn body của server action.
   */
  canFileKhiXacNhan?: boolean;
}

export interface ImportResult {
  ok: boolean;
  thongDiep: string;
  projectId?: string;
}
