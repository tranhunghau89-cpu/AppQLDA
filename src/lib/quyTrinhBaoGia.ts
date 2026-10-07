// Quy trình báo giá — các bước cố định mà nhân viên kinh doanh đi lần lượt.
//
// Quy trình KHÔNG lưu vào CSDL: mỗi bước "xong" hay chưa đọc thẳng từ dữ liệu thật
// của cơ hội (đã có dự toán chưa, đã có báo giá chưa, đã gửi chưa). Lưu riêng một cột
// "đang ở bước mấy" là mở đường cho nó lệch với dữ liệu — xóa báo giá đi mà quy trình
// vẫn nói bước báo giá đã xong.
//
// Logic thuần, không đụng Prisma, để test được.

export type LoaiBuoc = "KHACH_HANG" | "DU_TOAN" | "BAO_GIA" | "GUI_KHACH";

export interface BuocQuyTrinh {
  loai: LoaiBuoc;
  ten: string;
  huongDan: string;
}

export interface QuyTrinh {
  ma: string;
  ten: string;
  moTa: string;
  buoc: BuocQuyTrinh[];
}

const B_KHACH: BuocQuyTrinh = {
  loai: "KHACH_HANG",
  ten: "Khách hàng & công trình",
  huongDan:
    "Chọn khách có sẵn hoặc thêm khách mới, rồi khai công trình đang chào giá. Diện tích và loại công trình giúp chọn sẵn mẫu báo giá.",
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
    ma: "nhanh",
    ten: "Báo giá nhanh theo m²",
    moTa: "Công trình quen, đã có mẫu: lập thẳng báo giá đơn giá m² trọn gói, không cần dự toán chi tiết.",
    buoc: [B_KHACH, B_BAO_GIA, B_GUI],
  },
  {
    ma: "chi-tiet",
    ten: "Báo giá từ dự toán chi tiết",
    moTa: "Dựng giá thành từ dự toán chi tiết trước, rồi suy ra đơn giá m² cho bản gửi khách.",
    buoc: [B_KHACH, B_DU_TOAN, B_BAO_GIA, B_GUI],
  },
];

export function timQuyTrinh(ma: string): QuyTrinh | undefined {
  return QUY_TRINH_BAO_GIA.find((q) => q.ma === ma);
}

/** Số liệu của một cơ hội — đủ để biết bước nào đã xong. */
export interface TienDoCoHoi {
  soDuToanCoDong: number;
  soBaoGiaCoDong: number;
  soBaoGiaDaGui: number;
}

/** Trạng thái báo giá được tính là "đã ra khỏi công ty". */
export const BAO_GIA_DA_GUI = ["DA_GUI", "DAM_PHAN", "CHOT"];

/** Bước này xong chưa. Bước khách hàng luôn xong — có cơ hội mới có trang này. */
export function buocDaXong(loai: LoaiBuoc, t: TienDoCoHoi): boolean {
  switch (loai) {
    case "KHACH_HANG":
      return true;
    case "DU_TOAN":
      return t.soDuToanCoDong > 0;
    case "BAO_GIA":
      return t.soBaoGiaCoDong > 0;
    case "GUI_KHACH":
      return t.soBaoGiaDaGui > 0;
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
