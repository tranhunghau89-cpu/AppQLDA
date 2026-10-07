// Khuôn file Excel bảng giá: tạo ra để tải về, và đọc lại khi người dùng nộp lên.
// Hai chiều nằm cùng một chỗ để tên cột không bao giờ lệch nhau.

import ExcelJS, { type CellValue } from "exceljs";
import { WORK_GROUP_MAP, labelOf } from "@/lib/constants";
import { num, text } from "@/lib/import/cells";
import type { DongBangGia } from "./bangGia";
import type { DongBangGiaDb } from "./bangGiaDb";

const COT_SUA = ["vatTu", "nc", "heSo", "donGia"] as const;

export function taoFileBangGia(bang: readonly DongBangGiaDb[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Bang gia");
  ws.columns = [
    { header: "Mã", key: "ma", width: 10 },
    { header: "Nội dung", key: "ten", width: 50 },
    { header: "ĐVT", key: "donVi", width: 7 },
    { header: "Nhóm", key: "nhom", width: 22 },
    { header: "Vật tư", key: "vatTu", width: 12 },
    { header: "NC + Máy", key: "nc", width: 12 },
    { header: "Hệ số", key: "heSo", width: 8 },
    { header: "Đơn giá", key: "donGia", width: 13 },
    { header: "Hiệu lực từ (chỉ xem)", key: "hl", width: 14 },
  ];
  const tieuDe = ws.getRow(1);
  tieuDe.font = { bold: true };
  tieuDe.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FB" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const b of bang) {
    ws.addRow({
      ma: b.ma,
      ten: b.ten,
      donVi: b.donVi ?? "",
      nhom: labelOf(WORK_GROUP_MAP, b.nhomMa),
      vatTu: b.gia?.vatTu ?? null,
      nc: b.gia?.nhanCongMay ?? null,
      heSo: b.gia?.heSo ?? null,
      donGia: b.gia?.donGia ?? null,
      hl: b.hieuLucTu ?? null,
    });
  }
  for (const k of ["vatTu", "nc", "donGia"]) ws.getColumn(k).numFmt = "#,##0";
  ws.getColumn("hl").numFmt = "dd/mm/yyyy";
  // Tô vàng các cột có tác dụng khi nộp lại.
  for (const k of COT_SUA)
    ws.getColumn(k).eachCell((c, r) => {
      if (r > 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
    });
  return wb;
}

/** Ô số, kể cả khi người dùng gõ chữ kiểu Việt "20.600" vào ô định dạng Text. */
function soCuaO(v: CellValue): number | null {
  const n = num(v);
  if (n !== null) return n;
  const t = text(v).replace(/\s/g, "");
  if (!t) return null;
  const s = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(s) ? s : null;
}

export async function docFileBangGia(
  buf: ArrayBuffer
): Promise<{ ok: true; dong: DongBangGia[] } | { ok: false; error: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return { ok: false, error: "Không đọc được file — cần file .xlsx." };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, error: "File không có trang tính nào." };

  // Tìm dòng tiêu đề trong 10 dòng đầu — người dùng có thể chèn tiêu đề phía trên.
  let dongTieuDe = 0;
  const cot: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !dongTieuDe; r++) {
    ws.getRow(r).eachCell((c, i) => {
      const t = text(c.value).toLowerCase();
      if (t === "mã") {
        dongTieuDe = r;
        cot.ma = i;
      } else if (t.startsWith("vật tư")) cot.vatTu = i;
      else if (t.startsWith("nc")) cot.nhanCongMay = i;
      else if (t.startsWith("hệ số")) cot.heSo = i;
      else if (t.startsWith("đơn giá")) cot.donGia = i;
    });
  }
  if (!dongTieuDe || !cot.donGia)
    return {
      ok: false,
      error: 'Không thấy dòng tiêu đề có cột "Mã" và "Đơn giá" — hãy dùng file tải về từ đây.',
    };

  const dong: DongBangGia[] = [];
  for (let r = dongTieuDe + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ma = text(row.getCell(cot.ma).value);
    if (!ma) continue;
    const lay = (k: string) => (cot[k] ? soCuaO(row.getCell(cot[k]).value) : null);
    dong.push({
      ma,
      vatTu: lay("vatTu"),
      nhanCongMay: lay("nhanCongMay"),
      heSo: lay("heSo"),
      donGia: lay("donGia"),
    });
  }
  return { ok: true, dong };
}
