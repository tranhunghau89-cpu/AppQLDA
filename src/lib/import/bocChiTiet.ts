// Đọc file Excel bảng bóc khối lượng chi tiết. Phần bóc tách thuần nằm ở
// bocChiTiet-parse.ts (test được, không cần Next).
//
// KHÔNG đi qua trình nhập chung ở /import: bảng bóc phải gắn vào MỘT đầu mục dự toán cụ
// thể, mà trình nhập chung chỉ khớp tới dự án. Bắt người dùng chọn đầu mục trong một
// danh sách vài trăm dòng là cách chắc chắn để gắn nhầm — nút nhập đặt ngay trên dòng
// thì không có gì để chọn nhầm.
import "server-only";
import ExcelJS from "exceljs";
import { bocBangChiTiet, type KetQuaBocChiTiet, type SheetLike } from "./bocChiTiet-parse";

export { bocBangChiTiet } from "./bocChiTiet-parse";
export type { DongBoc, KetQuaBocChiTiet, LoaiBang } from "./bocChiTiet-parse";

/**
 * Quét MỌI sheet chứ không chỉ sheet đầu.
 *
 * File của phòng kỹ thuật hay kèm sheet bìa hoặc sheet ghi chú ở trước. Lấy sheet đầu
 * tiên NHẬN RA ĐƯỢC, và nếu không sheet nào nhận ra thì trả kết quả của sheet đầu để
 * người dùng đọc được câu giải thích vì sao.
 */
export async function docBangChiTiet(buffer: Buffer): Promise<KetQuaBocChiTiet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  let dauTien: KetQuaBocChiTiet | null = null;
  for (const ws of wb.worksheets) {
    const kq = bocBangChiTiet(ws as unknown as SheetLike);
    if (kq.loai != null && kq.dong.length > 0) return kq;
    dauTien ??= kq;
  }
  return (
    dauTien ?? {
      loai: null,
      tenCongTrinh: null,
      hangMuc: null,
      diaDiem: null,
      dong: [],
      canhBao: ["File không có sheet nào."],
    }
  );
}
