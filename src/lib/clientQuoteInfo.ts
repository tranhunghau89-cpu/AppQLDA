import { formatDate } from "./utils";

/**
 * Những ô IN RA bản báo giá gửi khách nhưng trên màn hình không để lại dấu vết nào.
 *
 * SĐT khách, địa điểm, họ tên / SĐT / email người phụ trách đều nằm ở đầu trang 1 của
 * tờ giấy, mà trước đây chỉ mở được trong hộp thoại sửa. Để trống thì bản in vẫn ra,
 * chỉ thiếu chỗ đó — và người lập biết được sau khi đã gửi cho khách.
 */
export interface NguonThongTin {
  recipient: string | null;
  customerPhone: string | null;
  location: string | null;
  scope: string | null;
  quoteDate: string | null;
  validDays: number | null;
  expiryDate: string | null;
  salesName: string | null;
  salesPhone: string | null;
  salesEmail: string | null;
}

export interface ONhap {
  /** Nhãn hiển thị. Không ô nào trùng nhãn — "SĐT" của khách và của người phụ trách
   *  là hai ô khác nhau, gọi chung một tên thì không biết ô nào đang trống. */
  nhan: string;
  /** Đã định dạng sẵn để hiển thị. Chuỗi rỗng = chưa điền. */
  giaTri: string;
}

function chu(v: string | null | undefined): string {
  // Gõ nhầm một dấu cách rồi lưu thì trên giấy vẫn là chỗ trống.
  return (v ?? "").trim();
}

function ngay(v: string | null | undefined): string {
  const s = formatDate(v);
  // `formatDate` trả "—" cho ngày rỗng hoặc hỏng; ở đây "—" nghĩa là chưa điền.
  return s === "—" ? "" : s;
}

function hieuLuc(q: NguonThongTin): string {
  // Số 0 là giá trị thật ("hết hiệu lực ngay"), không phải chỗ trống.
  if (q.validDays == null) return "";
  const han = ngay(q.expiryDate);
  return han ? `${q.validDays} ngày · đến ${han}` : `${q.validDays} ngày`;
}

/** Toàn bộ ô thông tin của một bản báo giá, theo thứ tự chúng xuất hiện trên giấy. */
export function thongTinIn(q: NguonThongTin): ONhap[] {
  return [
    { nhan: "Kính gửi", giaTri: chu(q.recipient) },
    { nhan: "SĐT khách", giaTri: chu(q.customerPhone) },
    { nhan: "Địa điểm", giaTri: chu(q.location) },
    { nhan: "Hạng mục", giaTri: chu(q.scope) },
    { nhan: "Ngày báo giá", giaTri: ngay(q.quoteDate) },
    { nhan: "Người phụ trách", giaTri: chu(q.salesName) },
    { nhan: "SĐT phụ trách", giaTri: chu(q.salesPhone) },
    { nhan: "Email phụ trách", giaTri: chu(q.salesEmail) },
    { nhan: "Hiệu lực", giaTri: hieuLuc(q) },
  ];
}

export function soOThieu(o: ONhap[]): number {
  return o.filter((x) => !x.giaTri).length;
}
