// Bóc tách file dự toán (sheet "TongHop") — phần THUẦN, không chạm DB và không
// "server-only", nên chạy được cả trong test lẫn script kiểm tra ngoài Next.
// Phần đọc file + ghi DB nằm ở estimate.ts.
import type { CellValue } from "exceljs";
import { norm, num, text } from "./cells";

/** Nhãn nhóm cấp 1 theo cột A của sheet TongHop. */
const GROUP_LABEL: Record<string, string> = {
  A: "Khung mái",
  B: "Vách",
  C: "Canopy",
  D: "Nóc gió",
  E: "Dầm sàn",
};

/**
 * Phân dòng vật tư về nhóm chi phí theo từ khóa trong tên.
 *
 * Lưu ý một chỗ dễ nhầm: nhánh NHAN_CONG được kiểm TRƯỚC nhánh TON, và "lợp" chuẩn
 * hóa thành "lop" nên "Lợp tôn" rơi vào NHAN_CONG. Đó là ĐÚNG — đã đối chiếu dữ liệu
 * thật, toàn bộ 26 dòng chứa "lợp" đều là công lắp đặt chứ không phải vật tư tôn.
 * Đừng đảo thứ tự hai nhánh này nếu chưa kiểm tra lại dữ liệu.
 */
export function phanNhom(itemName: string, subName: string): string {
  const s = norm(itemName + " " + subName);
  if (s.includes("vanchuyen")) return "VAN_CHUYEN";
  if (s.includes("lapdung") || s.includes("lapdat") || s.includes("lop") || s.includes("nhancong"))
    return "NHAN_CONG";
  if (s.includes("xago")) return "XA_GO";
  if (s.includes("neo") || s.includes("maduong")) return "BL_NEO";
  if (s.includes("bulong") || s.includes("tyxa") || s.includes("lienket")) return "BLLK";
  if (
    s.includes("ton") ||
    s.includes("diem") ||
    s.includes("mang") ||
    s.includes("ong") ||
    s.includes("vit") ||
    s.includes("keo") ||
    s.includes("phukien") ||
    s.includes("phieu")
  )
    return "TON";
  if (s.includes("thep") || s.includes("ketcau")) return "KCT";
  if (s.includes("giang") || s.includes("cap") || s.includes("tangdo")) return "VT_PHU";
  return "KHAC";
}

export interface DongDuToan {
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  unitPrice: number | null;
  amount: number;
  note: string | null;
  sortOrder: number;
}

export interface KetQuaBocTach {
  area: number | null;
  sale: number | null;
  total: number;
  dong: DongDuToan[];
  canhBao: string[];
}

/** Giao diện tối thiểu của một worksheet — để test không cần file Excel thật. */
export interface SheetLike {
  rowCount: number;
  getCell(row: number, col: number): { value: CellValue };
}

/**
 * Bóc sheet TongHop thành các dòng dự toán. Hàm THUẦN.
 *
 * Cấu trúc sheet: diện tích ở D3:D7; từ dòng 9 trở đi, cột A là chữ cái nhóm (A–E),
 * dòng có cột A khác rỗng là dòng tiêu đề mục (bỏ qua vì là subtotal), dòng có cột A
 * rỗng mà cột B và F có giá trị mới là dòng vật tư thật.
 */
export function bocTachDuToan(ws: SheetLike): KetQuaBocTach {
  const canhBao: string[] = [];
  const boQua: string[] = [];

  let area = 0;
  for (let r = 3; r <= 7; r++) {
    const d = num(ws.getCell(r, 4).value);
    if (d) area += d;
  }

  const dong: DongDuToan[] = [];
  let nhomHienTai: string | null = null;
  let mucHienTai = "";
  let sort = 0;

  for (let r = 9; r <= ws.rowCount; r++) {
    const a = text(ws.getCell(r, 1).value);
    const b = text(ws.getCell(r, 2).value);
    const f = num(ws.getCell(r, 6).value);

    if (/^[A-E]$/i.test(a)) {
      nhomHienTai = a.toUpperCase();
      mucHienTai = "";
      continue;
    }
    if (a !== "") {
      mucHienTai = b;
      continue;
    }
    if (b && f && f !== 0 && nhomHienTai) {
      const unit = text(ws.getCell(r, 3).value) || null;
      const designQty = num(ws.getCell(r, 4).value);
      const unitPrice = num(ws.getCell(r, 5).value);
      const quyCach = text(ws.getCell(r, 8).value);
      const ghiChu = text(ws.getCell(r, 9).value);
      const ctx = [GROUP_LABEL[nhomHienTai] ?? nhomHienTai, mucHienTai].filter(Boolean).join(" › ");
      const noteParts = [ctx, quyCach, ghiChu].filter(Boolean);
      dong.push({
        groupCode: phanNhom(b, mucHienTai),
        name: b,
        unit,
        designQty,
        unitPrice,
        amount: f,
        note: noteParts.length ? noteParts.join(" — ") : null,
        sortOrder: sort++,
      });
    } else if (b && f === null && nhomHienTai && a === "") {
      // Dòng có tên nhưng không có thành tiền. Trong file thật loại này rất nhiều
      // (dòng để trống sẵn cho hạng mục chưa dùng) nên GỘP thành một cảnh báo duy
      // nhất — liệt kê từng dòng thì cảnh báo nào cũng chạm trần và mất tác dụng.
      if (b.length > 3) boQua.push(b);
    }
  }

  const total = dong.reduce((s, l) => s + l.amount, 0);

  // Ô J1 đôi khi chứa giá bán, đôi khi là số rác. Chỉ nhận khi hợp lý so với tổng CP.
  const j1 = num(ws.getCell(1, 10).value);
  let sale: number | null = null;
  if (j1 != null && total > 0) {
    if (j1 <= 10 * total) sale = j1;
    else canhBao.push(`Ô J1 = ${j1.toLocaleString("vi-VN")} lớn bất thường so với tổng chi phí — bỏ qua giá bán.`);
  }

  if (boQua.length > 0) {
    const vd = boQua.slice(0, 3).join(", ");
    canhBao.push(
      `${boQua.length} dòng có tên nhưng không có thành tiền, đã bỏ qua (ví dụ: ${vd}${boQua.length > 3 ? "…" : ""}).`
    );
  }
  if (dong.length === 0) canhBao.push("Không tìm thấy dòng vật tư nào — kiểm tra lại cấu trúc sheet TongHop.");
  if (area === 0) canhBao.push("Không đọc được diện tích (D3:D7) — sẽ giữ nguyên diện tích cũ.");

  return { area: area || null, sale, total, dong, canhBao: canhBao.slice(0, 20) };
}
