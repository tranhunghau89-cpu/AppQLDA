import ExcelJS from "exceljs";
import { ESTIMATE_GROUP_MAP } from "./constants";
import { computeActualAmount, computeActualCost, computeAmount, computeProfit } from "./profit";

export interface ExportItem {
  sectionId: string | null;
  groupLabel: string | null;
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  actualQty: number | null;
  unitPrice: number | null;
  actualUnitPrice: number | null;
  amount: number | null;
  note: string | null;
  sortOrder: number;
  supplierName: string | null;
}

export interface ExportSection {
  id: string;
  code: string | null;
  name: string;
  sortOrder: number;
}

export interface ExportProject {
  code: string;
  name: string;
  salePrice: number | null;
  area: number | null;
  items: ExportItem[];
  sections: ExportSection[];
}

const GREY = "FFE9EDF2";
const DARK = "FF33415C";
const AMBER = "FFFDF3E1";

function groupByLabel(rows: ExportItem[]) {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const order: string[] = [];
  const map = new Map<string, ExportItem[]>();
  for (const r of sorted) {
    const label = r.groupLabel ?? ESTIMATE_GROUP_MAP[r.groupCode]?.label ?? r.groupCode;
    if (!map.has(label)) {
      map.set(label, []);
      order.push(label);
    }
    map.get(label)!.push(r);
  }
  return order.map((label) => ({ label, rows: map.get(label)! }));
}

/** Tổng thực của một nhóm dòng: rỗng khi chưa dòng nào có giá thực (giống màn hình). */
function tongThuc(rows: ExportItem[]): number | "" {
  const t = computeActualCost(rows);
  return t.soDongCoGia === 0 ? "" : t.total;
}

/** Gom item theo Hạng mục (Section) → giữ thứ tự; item chưa phân → cuối. */
export function toBlocks(p: ExportProject) {
  const bySection = new Map<string, ExportItem[]>();
  for (const it of p.items) {
    const key = it.sectionId ?? "__none__";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(it);
  }
  const blocks: { code: string | null; name: string; rows: ExportItem[] }[] = [];
  for (const s of [...p.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const rows = bySection.get(s.id);
    if (rows) blocks.push({ code: s.code, name: s.name, rows });
  }
  const none = bySection.get("__none__");
  if (none) blocks.push({ code: null, name: "Chưa phân hạng mục", rows: none });
  return blocks;
}

export async function buildEstimateWorkbook(
  p: ExportProject,
  opts: { showProfit: boolean }
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Dự toán ${p.code}`);

  ws.mergeCells("A1:K1");
  ws.getCell("A1").value = `DỰ TOÁN — ${p.code} ${p.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  // Hai tầng tiêu đề: nhóm Dự toán / Thực tế, rồi tên cột.
  const tren = ws.addRow(["STT", "Hạng mục", "Đơn vị", "DỰ TOÁN", "", "", "THỰC TẾ (MUA HÀNG)", "", "", "NCC", "Ghi chú"]);
  const header = ws.addRow(["", "", "", "Khối lượng", "Đơn giá", "Thành tiền", "KL thực", "Đơn giá thực", "Thành tiền thực", "", ""]);
  const r1 = tren.number;
  const r2 = header.number;
  ws.mergeCells(r1, 4, r1, 6);
  ws.mergeCells(r1, 7, r1, 9);
  for (const col of [1, 2, 3, 10, 11]) ws.mergeCells(r1, col, r2, col);
  for (const row of [tren, header]) {
    row.font = { bold: true };
    for (let col = 1; col <= 11; col++) {
      const c = row.getCell(col);
      const thuc = col >= 7 && col <= 9;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: thuc ? AMBER : GREY } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  }

  const fillRow = (row: ExcelJS.Row, argb: string, fontColor?: string) => {
    row.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      if (fontColor) c.font = { bold: true, color: { argb: fontColor } };
    });
  };

  for (const block of toBlocks(p)) {
    const sectionTotal = block.rows.reduce((a, r) => a + computeAmount(r), 0);
    const secRow = ws.addRow([
      block.code ?? "",
      `HẠNG MỤC ${block.name.toUpperCase()}`,
      "",
      "",
      "",
      sectionTotal,
      "",
      "",
      tongThuc(block.rows),
      "",
      "",
    ]);
    fillRow(secRow, DARK, "FFFFFFFF");

    let n = 1;
    for (const grp of groupByLabel(block.rows)) {
      const subtotal = grp.rows.reduce((a, r) => a + computeAmount(r), 0);
      const grpRow = ws.addRow([n, grp.label, "", "", "", subtotal, "", "", tongThuc(grp.rows), "", ""]);
      grpRow.font = { bold: true };
      fillRow(grpRow, GREY);
      n += 1;

      for (const it of grp.rows) {
        ws.addRow([
          "",
          `    ${it.name}`,
          it.unit ?? "",
          it.designQty ?? "",
          it.unitPrice ?? "",
          computeAmount(it),
          it.actualQty ?? "",
          it.actualUnitPrice ?? "",
          computeActualAmount(it) ?? "",
          it.supplierName ?? "",
          it.note ?? "",
        ]);
      }
    }
  }

  const s = computeProfit(p.items, p.salePrice, p.area);
  ws.addRow([]);
  const thuc = computeActualCost(p.items);
  ws.addRow(["", "", "", "", "TỔNG CHI PHÍ", s.totalCost, "", "Tổng thực", thuc.total]).font = { bold: true };
  if (thuc.soDongCoGia < thuc.soDong) {
    ws.addRow([
      "", "", "", "", "", "", "", "",
      `${thuc.soDongCoGia}/${thuc.soDong} dòng có giá thực — còn lại tạm theo dự toán`,
    ]).font = { italic: true, color: { argb: "FF888888" } };
  }
  if (opts.showProfit) {
    ws.addRow(["", "", "", "", "Giá bán", s.salePrice, "", "Giá bán", s.salePrice]);
    ws.addRow(["", "", "", "", "Lợi nhuận", s.profit, "", "Lợi nhuận thực", s.salePrice - thuc.total]).font = { bold: true };
  }

  ws.getColumn(4).numFmt = "#,##0.##";
  ws.getColumn(5).numFmt = "#,##0";
  ws.getColumn(6).numFmt = "#,##0";
  ws.getColumn(7).numFmt = "#,##0.##";
  ws.getColumn(8).numFmt = "#,##0";
  ws.getColumn(9).numFmt = "#,##0";
  ws.columns.forEach((c) => {
    c.width = 15;
  });
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 32;

  return wb;
}
