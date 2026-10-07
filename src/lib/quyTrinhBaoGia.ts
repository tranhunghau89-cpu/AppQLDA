// Quy trình kinh doanh — các bước cố định mà nhân viên kinh doanh đi lần lượt.
//
// Quy trình KHÔNG lưu vào CSDL: mỗi bước "xong" hay chưa đọc thẳng từ dữ liệu thật
// (đã có dự toán chưa, đã có báo giá chưa, đã gửi chưa, hôm nay đã ghi trao đổi chưa).
// Lưu riêng một cột "đang ở bước mấy" là mở đường cho nó lệch với dữ liệu — xóa báo
// giá đi mà quy trình vẫn nói bước báo giá đã xong.
//
// Logic thuần, không đụng Prisma, để test được.

export type LoaiBuoc = "KHACH_HANG" | "DU_TOAN" | "BAO_GIA" | "GUI_KHACH" | "TRAO_DOI";

export interface BuocQuyTrinh {
  loai: LoaiBuoc;
  ten: string;
  huongDan: string;
}

export interface QuyTrinh {
  ma: string;
  ten: string;
  moTa: string;
  /** Quy trình chạy trên một công trình chào giá, hay chỉ trên một khách hàng. */
  doiTuong: "CO_HOI" | "KHACH";
  buoc: BuocQuyTrinh[];
}

const B_KHACH: BuocQuyTrinh = {
  loai: "KHACH_HANG",
  ten: "Khách hàng & công trình",
  huongDan:
    "Chọn khách có sẵn hoặc thêm khách mới, rồi khai công trình đang chào giá. Diện tích và loại công trình giúp chọn sẵn mẫu báo giá.",
};
const B_KHACH_RIENG: BuocQuyTrinh = {
  loai: "KHACH_HANG",
  ten: "Khách hàng",
  huongDan: "Chọn khách có sẵn để cập nhật, hoặc thêm khách mới.",
};
const B_TRAO_DOI: BuocQuyTrinh = {
  loai: "TRAO_DOI",
  ten: "Cập nhật trao đổi",
  huongDan:
    "Ghi lại cuộc gọi / buổi gặp / tin nhắn với khách, và hẹn ngày liên hệ lại nếu có — ngày hẹn sẽ vào bản tin nhắc việc. Cần ít nhất một ghi chép mới trong hôm nay.",
};
const B_DU_TOAN: BuocQuyTrinh = {
  loai: "DU_TOAN",
  ten: "Dự toán chi tiết",
  huongDan:
    "Tạo bản dự toán và thêm các dòng công tác — đơn giá lấy từ thư viện theo khu vực. Cần ít nhất một bản có dòng mới đi tiếp được.",
};
const B_BAO_GIA: BuocQuyTrinh = {
  loai: "BAO_GIA",
  ten: "Báo giá gửi khách",
  huongDan:
    "Lập báo giá gửi khách (từ mẫu, hoặc sinh từ dự toán ở bước trước), điền hạng mục, điều khoản và tiến độ thanh toán. Cần ít nhất một báo giá có hạng mục.",
};
const B_GUI: BuocQuyTrinh = {
  loai: "GUI_KHACH",
  ten: "In & gửi khách",
  huongDan:
    "Xem bản in, lưu PDF gửi khách rồi bấm \"Đánh dấu đã gửi\" — hạn hiệu lực sẽ được chốt từ lúc này.",
};

export const QUY_TRINH_BAO_GIA: QuyTrinh[] = [
  {
    ma: "trao-doi",
    ten: "Tạo khách & cập nhật trao đổi",
    moTa: "Thêm khách mới hoặc chọn khách cũ, rồi ghi lại nội dung trao đổi và hẹn liên hệ lại.",
    doiTuong: "KHACH",
    buoc: [B_KHACH_RIENG, B_TRAO_DOI],
  },
  {
    ma: "nhanh",
    ten: "Báo giá nhanh theo m²",
    moTa: "Công trình quen, đã có mẫu: lập thẳng báo giá đơn giá m² trọn gói, không cần dự toán chi tiết.",
    doiTuong: "CO_HOI",
    buoc: [B_KHACH, B_BAO_GIA, B_GUI],
  },
  {
    ma: "chi-tiet",
    ten: "Báo giá từ dự toán chi tiết",
    moTa: "Dựng giá thành từ dự toán chi tiết trước, rồi suy ra đơn giá m² cho bản gửi khách.",
    doiTuong: "CO_HOI",
    buoc: [B_KHACH, B_DU_TOAN, B_BAO_GIA, B_GUI],
  },
];

export function timQuyTrinh(ma: string): QuyTrinh | undefined {
  return QUY_TRINH_BAO_GIA.find((q) => q.ma === ma);
}

/** Số liệu của một cơ hội / khách — đủ để biết bước nào đã xong. Thiếu = 0. */
export interface TienDoCoHoi {
  soDuToanCoDong?: number;
  soBaoGiaCoDong?: number;
  soBaoGiaDaGui?: number;
  /** Ghi chép trao đổi tạo trong hôm nay — khách cũ có ghi chép từ trước không tính. */
  soTraoDoiHomNay?: number;
}

/** Trạng thái báo giá được tính là "đã ra khỏi công ty". */
export const BAO_GIA_DA_GUI = ["DA_GUI", "DAM_PHAN", "CHOT"];

/** Bước này xong chưa. Bước khách hàng luôn xong — có cơ hội/khách mới có trang này. */
export function buocDaXong(loai: LoaiBuoc, t: TienDoCoHoi): boolean {
  switch (loai) {
    case "KHACH_HANG":
      return true;
    case "DU_TOAN":
      return (t.soDuToanCoDong ?? 0) > 0;
    case "BAO_GIA":
      return (t.soBaoGiaCoDong ?? 0) > 0;
    case "GUI_KHACH":
      return (t.soBaoGiaDaGui ?? 0) > 0;
    case "TRAO_DOI":
      return (t.soTraoDoiHomNay ?? 0) > 0;
  }
}

/**
 * Bước xa nhất được phép mở (đánh số từ 1): bước chưa xong đầu tiên. Mọi bước đã xong
 * thì là bước cuối. Không cho nhảy qua một bước chưa làm.
 */
export function buocToiDa(qt: QuyTrinh, t: TienDoCoHoi): number {
  const i = qt.buoc.findIndex((b) => !buocDaXong(b.loai, t));
  return i === -1 ? qt.buoc.length : i + 1;
}

/** Đọc `?buoc=` từ URL: thiếu hay sai thì về bước tới đa; vượt quá thì kẹp lại. */
export function chonBuoc(qt: QuyTrinh, t: TienDoCoHoi, thamSo: string | undefined): number {
  const toiDa = buocToiDa(qt, t);
  const n = Number(thamSo);
  if (!thamSo || !Number.isInteger(n) || n < 1) return toiDa;
  return Math.min(n, toiDa);
}

/** 0h hôm nay theo giờ Việt Nam (UTC+7), ra mốc UTC — máy chủ chạy UTC. */
export function dauNgayVN(bayGio: Date = new Date()): Date {
  const LECH = 7 * 3600 * 1000;
  const vn = new Date(bayGio.getTime() + LECH);
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - LECH);
}
