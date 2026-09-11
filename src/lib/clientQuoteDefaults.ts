// Giá trị mặc định của một bản báo giá gửi khách — chép từ mẫu báo giá thật của
// công ty (bản K50L120, Hồng Ngự - Đồng Tháp).
//
// Dùng ở hai chỗ: rót sẵn khi tạo báo giá mới chưa chọn mẫu, và làm dữ liệu seed
// cho "Mẫu mặc định" trong thư viện mẫu. Khi đã chọn mẫu thì mẫu đè lên các giá
// trị này.
//
// Đây là dữ liệu thuần, không phụ thuộc Prisma — để test được và để dùng được ở
// cả hai phía.

export interface SpecSeed {
  groupCode: "A" | "B";
  name: string;
  spec: string | null;
  origin: string | null;
}

/** Bảng "Vật liệu áp dụng và thông số kỹ thuật" — 10 dòng nhóm A, 6 dòng nhóm B. */
export const DEFAULT_SPECS: SpecSeed[] = [
  // A — Vật liệu kết cấu thép
  { groupCode: "A", name: "Thép tấm tổ hợp", spec: "fy = 2.450 kG/cm2", origin: "Q235 hoặc tương đương" },
  { groupCode: "A", name: "Thép hình", spec: "fy = 2.100 kG/cm2", origin: "JIS G3193 hoặc tương đương" },
  { groupCode: "A", name: "Xà gồ mái, vách", spec: "G350Z80", origin: "Mạ kẽm" },
  { groupCode: "A", name: "Giằng, chống xà gồ", spec: "fy = 2.100 kG/cm2", origin: null },
  { groupCode: "A", name: "Que hàn", spec: "E42 / tương đương", origin: null },
  { groupCode: "A", name: "Làm sạch bề mặt", spec: "SA1.2", origin: "Làm sạch bằng phun bi" },
  { groupCode: "A", name: "Sơn phủ", spec: "Sơn Alkyd, 80mcr", origin: "1 lớp chống rỉ, 2 lớp sơn màu" },
  { groupCode: "A", name: "Bulong neo", spec: "Class 4*6", origin: "Mạ kẽm" },
  { groupCode: "A", name: "Bu lông liên kết khung chính", spec: "Class 8*8", origin: "Mạ kẽm" },
  { groupCode: "A", name: "Bu lông liên kết giằng, xà gồ", spec: "Class 5*6", origin: "Mạ kẽm" },
  // B — Vật liệu tôn lợp và bao che
  { groupCode: "B", name: "Tôn mái sóng CN", spec: "0.45mm, AZ50G550", origin: "Tôn Đông Á or tương đương" },
  { groupCode: "B", name: "Tôn thưng sóng CN", spec: "0.40mm, AZ50G550", origin: "Tôn Đông Á or tương đương" },
  { groupCode: "B", name: "Máng nước khổ <800mm", spec: "0.45mm, AZ50G550", origin: "Tôn Đông Á or tương đương" },
  { groupCode: "B", name: "Ke diềm phụ kiện", spec: "0.40mm, AZ50G550", origin: "Tôn Đông Á or tương đương" },
  { groupCode: "B", name: "Ống nước", spec: "D90", origin: null },
  { groupCode: "B", name: "Keo, vít các loại", spec: null, origin: "KCC - Hàn Quốc. Vít SEC" },
];

export interface StageSeed {
  name: string;
  days: number;
}

/** Tiến độ thi công (ghi chú 4) — tổng 55 ngày. */
export const DEFAULT_STAGES: StageSeed[] = [
  { name: "Ra bản vẽ sản xuất", days: 3 },
  { name: "Gia công cấu kiện", days: 15 },
  { name: "Vận chuyển", days: 2 },
  { name: "Lắp dựng khung", days: 25 },
  { name: "Lợp tôn và hoàn thiện", days: 10 },
];

export interface PaymentSeed {
  label: string;
  percent: number;
  basis: string | null;
  note: string | null;
}

/** Tiến độ thanh toán (ghi chú 8) — 30 / 40 / 20 / 10, cộng đủ 100%. */
export const DEFAULT_PAYMENTS: PaymentSeed[] = [
  { label: "Sau khi kí hợp đồng", percent: 30, basis: "GTHĐ", note: "kí hợp đồng" },
  { label: "Sau khi tập kết vật tư", percent: 40, basis: "GTHĐ", note: "giao vật tư" },
  { label: "Sau khi dựng xong khung", percent: 20, basis: "GTHĐ", note: "lắp xong khung" },
  { label: "Hoàn thiện công trình", percent: 10, basis: "Quyết toán", note: "thư bảo lãnh 5%" },
];

/** Tải trọng tính toán (ghi chú 1) — kg/m2. */
export const DEFAULT_LOADS = { roof: 10, hanging: 30, floor: 150 };

export const DEFAULT_VAT_PERCENT = 10;
export const DEFAULT_VALID_DAYS = 7;
export const DEFAULT_WARRANTY_MONTHS = 12;
export const DEFAULT_MAINTENANCE_MONTHS = 120;

export const DEFAULT_GREETING =
  "Lời đầu Công ty CP XD Dubai xin gửi lời chào và chúc thành công đến Anh (Chị) và Quý công ty.\n" +
  "Cảm ơn quý vị đã tin tưởng, tạo điều kiện cho chúng tôi tham gia chào giá dự án này.\n" +
  "Căn cứ vào nhu cầu của quý vị và năng lực của Cty Chúng tôi, xin gửi tới Quý Cty bảng chào giá chi tiết cho dự án:";

export const DEFAULT_CLOSING = "Chân thành cảm ơn sự hợp tác của Quý khách hàng.";

/**
 * Mô tả chung in dưới tên MỌI hạng mục.
 *
 * Trong báo giá mẫu, hai dòng này lặp y hệt ở cả bốn hạng mục, nên để một chỗ rồi
 * dùng chung. Hạng mục nào cần khác (vd tôn thưng 0,40 mm thay vì tôn mái 0,45 mm)
 * thì điền riêng vào dòng đó để đè lên.
 */
export const DEFAULT_LINE_DETAIL =
  "- Gia công sản xuất theo bản vẽ thiết kế.\n" +
  "- Tôn mái là tôn Đông Á độ dày 0,45 mm mạ màu, 5 sóng công nghiệp.";

export const DEFAULT_COLOR_NOTE =
  "Màu được sử dụng trong là màu thông dụng tại kho ncc. Màu khác chi phí sẽ điều chỉnh theo mã màu cụ thể.";

export const DEFAULT_VOLUME_NOTE =
  "Khối lượng trên chỉ là tạm tính, khối lượng thực tế sẽ được hai bên thống nhất khi quyết toán công trình.";

export const DEFAULT_EXCLUDE_NOTE =
  "Báo giá trên không bao gồm vật liệu thí nghiệm và chi phí thí nghiệm.";
