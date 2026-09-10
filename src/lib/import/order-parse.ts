// Bóc tách file Đơn đặt hàng vật tư (DH_*.xlsx) — phần THUẦN, không chạm DB và
// không "server-only", nên chạy được cả trong test lẫn script kiểm chứng ngoài Next.
// Phần đọc file, trích ảnh biên dạng và ghi DB nằm ở order.ts.
//
// Một file = một đơn hàng, nhưng trải trên NHIỀU sheet (mỗi sheet một loại vật tư).
// Khác hai bộ nhập trước ở chỗ vị trí cột không cố định: mỗi file một kiểu, nên phải
// dò tiêu đề để biết cột nào là gì (`doCot`).
import type { CellValue } from "exceljs";
import { norm, num, text } from "./cells";

/** Sheet trong file đơn hàng — cần thêm `name` so với SheetLike chung. */
export interface OrderSheetLike {
  name: string;
  rowCount: number;
  columnCount?: number;
  getCell(row: number, col: number): { value: CellValue };
}

export interface DongDonHang {
  category: string;
  groupName: string | null;
  name: string;
  unit: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  weight: number | null;
  note: string | null;
  sortOrder: number;
  /** Dòng nguồn trong sheet — dùng để gắn ảnh biên dạng vào đúng vật tư. */
  row: number;
  /** Chỉ số sheet trong file. */
  si: number;
}

export interface KetQuaSheet {
  dong: DongDonHang[];
  /** 0 = sheet này không phải bảng đặt hàng (bỏ qua, không phải lỗi). */
  headerRow: number;
  /** Lý do bỏ qua, để gộp vào cảnh báo. */
  boQua: string | null;
}

/** Bỏ tiền tố đánh số "1. " trong tên sheet. */
export function tenSheetSach(sn: string): string {
  return sn.replace(/^\s*\d+\.\s*/, "").trim();
}

/**
 * Danh mục chuẩn hóa từ tên file: KCT | XA_GO | TON | VTP.
 *
 * Thứ tự kiểm quan trọng: "xg" nằm trước nhánh tôn, và mọi thứ còn lại (bu lông,
 * panel, cửa lùa, phụ kiện...) gom về VTP thay vì báo lỗi — đơn hàng vật tư phụ có
 * quá nhiều biến thể tên để liệt kê hết.
 */
export function danhMucTuTen(fileName: string): string {
  const n = norm(fileName);
  if (n.includes("kct") || n.includes("ketcau")) return "KCT";
  if (n.includes("xago") || n.includes("xg")) return "XA_GO";
  if (n.includes("dhton") || n.includes("ton")) return "TON";
  return "VTP";
}

/** Ngày đặt hàng nằm ngay trong tên file: "26_0507_DH_..." -> 2026-05-07. */
export function ngayTuTen(stem: string): Date | null {
  const m = stem.match(/^(\d{2})_(\d{2})(\d{2})/);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  const nam = 2000 + Number(yy);
  const thang = Number(mm);
  const ngay = Number(dd);
  if (thang < 1 || thang > 12 || ngay < 1 || ngay > 31) return null;
  const d = new Date(nam, thang - 1, ngay);
  // Chặn "26_0231" (31/02) — Date tự trôi sang tháng sau mà không báo gì.
  return d.getMonth() === thang - 1 && d.getDate() === ngay ? d : null;
}

/** Rút "K16L20" từ tên file để khớp dự án. */
export function kichThuocTuTen(s: string): string | null {
  const m = s.match(/(K\d+L\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Dò xem cột nào là gì từ dòng tiêu đề.
 *
 * Mỗi file đặt hàng một kiểu cột nên không thể cố định chỉ số. Dùng `!(key in col)`
 * chứ không phải `!col[key]` — cột 0 không tồn tại trong Excel 1-based nên hai cách
 * này tương đương ở đây, nhưng viết rõ ràng thì lần sau sửa không sinh lỗi.
 */
export function doCot(ws: OrderSheetLike, hdr: number): Record<string, number> {
  const col: Record<string, number> = {};
  const maxC = Math.max(ws.columnCount ?? 0, 12);
  for (let c = 1; c <= maxC; c++) {
    const n = norm(ws.getCell(hdr, c).value);
    if (!n) continue;
    if ((n.includes("tenhang") || n.includes("quycach")) && !("name" in col)) col.name = c;
    else if (n === "sl" && !("qty" in col)) col.qty = c;
    else if (n.includes("donvi") && !("unit" in col)) col.unit = c;
    else if (n.includes("dongia") && !("price" in col)) col.price = c;
    else if (n.includes("thanhtien") && !("amount" in col)) col.amount = c;
    else if (n.includes("trongluong") && !("weight" in col)) col.weight = c;
    else if (n.includes("ghichu") && !("note" in col)) col.note = c;
  }
  return col;
}

/**
 * Bóc một sheet thành các dòng vật tư. Hàm THUẦN.
 *
 * Sheet chỉ được nhận khi có CẢ marker "ĐẶT HÀNG" ở đầu VÀ dòng tiêu đề có ô "STT".
 * File đơn hàng thật hay kèm sheet phụ (tính toán, ghi chú) — bỏ qua chúng là đúng,
 * không phải lỗi.
 */
export function bocTachSheet(
  ws: OrderSheetLike,
  sheetCat: string,
  startSort: number,
  si: number
): KetQuaSheet {
  let marker = false;
  for (let r = 1; r <= 8; r++) {
    if (text(ws.getCell(r, 1).value).includes("ĐẶT HÀNG")) marker = true;
  }
  if (!marker) return { dong: [], headerRow: 0, boQua: "không có dòng ĐẶT HÀNG" };

  let hdr = 0;
  for (let r = 1; r <= 16; r++) {
    if (norm(ws.getCell(r, 1).value) === "stt") {
      hdr = r;
      break;
    }
  }
  if (!hdr) return { dong: [], headerRow: 0, boQua: "không tìm thấy dòng tiêu đề STT" };

  const col = doCot(ws, hdr);
  const nameCol = col.name ?? 2;

  const dong: DongDonHang[] = [];
  let group: string | null = null;
  let sort = startSort;

  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const aStr = text(ws.getCell(r, 1).value);
    const name = text(ws.getCell(r, nameCol).value);

    // Cột A là một chữ cái đơn -> dòng tiêu đề hạng mục.
    if (aStr.length === 1 && /[A-Za-z]/.test(aStr)) {
      group = name || group;
      continue;
    }
    if (aStr.toLowerCase().includes("tổng")) break;
    if (!name) {
      // Cột A có chữ mà không phải số thứ tự -> cũng là tiêu đề mục (gặp ở sheet Tôn).
      if (aStr && !/^\d+$/.test(aStr)) group = aStr;
      continue;
    }

    const qty = col.qty ? num(ws.getCell(r, col.qty).value) : null;
    const weight = col.weight ? num(ws.getCell(r, col.weight).value) : null;
    // Không có cả số lượng lẫn trọng lượng thì không phải dòng đặt hàng thật.
    if ((qty == null || qty === 0) && (weight == null || weight === 0)) continue;

    dong.push({
      category: sheetCat,
      groupName: group,
      name,
      unit: col.unit ? text(ws.getCell(r, col.unit).value) || null : null,
      qty,
      unitPrice: col.price ? num(ws.getCell(r, col.price).value) : null,
      amount: col.amount ? num(ws.getCell(r, col.amount).value) : null,
      weight,
      note: col.note ? text(ws.getCell(r, col.note).value) || null : null,
      sortOrder: sort++,
      row: r,
      si,
    });
  }

  return { dong, headerRow: hdr, boQua: null };
}

export interface KetQuaDonHang {
  orderNo: string;
  category: string;
  orderDate: Date | null;
  dims: string | null;
  dong: DongDonHang[];
  tongTien: number;
  tongTrongLuong: number;
  /** Tên các sheet bị bỏ qua, kèm lý do — gộp lại thành một cảnh báo. */
  sheetBoQua: string[];
  canhBao: string[];
}

/** Ghép kết quả các sheet thành một đơn hàng. Hàm THUẦN. */
export function bocTachDonHang(sheets: OrderSheetLike[], fileName: string): KetQuaDonHang {
  const stem = fileName.replace(/\.xlsx?$/i, "");
  const dong: DongDonHang[] = [];
  const sheetBoQua: string[] = [];

  sheets.forEach((ws, si) => {
    const kq = bocTachSheet(ws, tenSheetSach(ws.name), dong.length, si);
    if (kq.boQua) sheetBoQua.push(`${ws.name} (${kq.boQua})`);
    else if (kq.dong.length === 0) sheetBoQua.push(`${ws.name} (không có dòng vật tư nào)`);
    dong.push(...kq.dong);
  });

  const canhBao: string[] = [];
  if (dong.length === 0) {
    canhBao.push(
      "Không bóc được dòng vật tư nào — file phải có sheet chứa chữ ĐẶT HÀNG và dòng tiêu đề STT."
    );
  }
  if (sheetBoQua.length > 0) {
    const vd = sheetBoQua.slice(0, 3).join("; ");
    canhBao.push(
      `Bỏ qua ${sheetBoQua.length} sheet không phải bảng đặt hàng: ${vd}${sheetBoQua.length > 3 ? "…" : ""}`
    );
  }

  const thieuGia = dong.filter((d) => d.amount == null || d.amount === 0).length;
  if (thieuGia > 0 && thieuGia < dong.length) {
    canhBao.push(`${thieuGia}/${dong.length} dòng không có thành tiền — giá trị đơn sẽ thiếu phần này.`);
  } else if (thieuGia > 0 && thieuGia === dong.length) {
    canhBao.push("Toàn bộ dòng đều không có thành tiền — đơn này chỉ theo dõi khối lượng, giá trị = 0.");
  }

  return {
    orderNo: stem,
    category: danhMucTuTen(fileName),
    orderDate: ngayTuTen(stem),
    dims: kichThuocTuTen(stem),
    dong,
    tongTien: dong.reduce((s, i) => s + (i.amount ?? 0), 0),
    tongTrongLuong: dong.reduce((s, i) => s + (i.weight ?? 0), 0),
    sheetBoQua,
    canhBao: canhBao.slice(0, 20),
  };
}

/**
 * Gắn mỗi ảnh biên dạng vào dòng vật tư gần nhất PHÍA TRÊN trong cùng sheet.
 *
 * Trong file thật, ảnh biên dạng được chèn ngay dưới dòng vật tư mà nó minh họa.
 * Nếu không có dòng nào phía trên (ảnh nằm trên cùng) thì gắn vào dòng đầu tiên —
 * thà gắn hơi lệch còn hơn mất ảnh.
 *
 * Trả về mảng `sortOrder` tương ứng từng ảnh, `-1` nghĩa là không gắn được.
 */
export function ganAnhVaoDong(
  dong: DongDonHang[],
  anh: { si: number; anchorRow: number }[]
): number[] {
  return anh.map((img) => {
    const cungSheet = dong.filter((it) => it.si === img.si);
    if (!cungSheet.length) return -1;
    const phiaTren = cungSheet.filter((it) => it.row <= img.anchorRow);
    const target = phiaTren.length
      ? phiaTren.reduce((a, b) => (b.row > a.row ? b : a))
      : cungSheet.reduce((a, b) => (b.row < a.row ? b : a));
    return target.sortOrder;
  });
}
