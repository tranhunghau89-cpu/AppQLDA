import ExcelJS from "exceljs";
import { ESTIMATE_GROUP_MAP } from "./constants";
import { computeAmount, computeProfit } from "./profit";

export interface ExportItem {
  sectionId: string | null;
  groupLabel: string | null;
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  actualQty: number | null;
  unitPrice: number | null;
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

  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `DỰ TOÁN — ${p.code} ${p.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  const header = ws.addRow(["STT", "Hạng mục", "Đơn vị", "Khối lượng", "Đơn giá", "Thành tiền", "NCC", "Ghi chú"]);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    c.alignment = { horizontal: "center" };
  });

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
    ]);
    fillRow(secRow, DARK, "FFFFFFFF");

    let n = 1;
    for (const grp of groupByLabel(block.rows)) {
      const subtotal = grp.rows.reduce((a, r) => a + computeAmount(r), 0);
      const grpRow = ws.addRow([n, grp.label, "", "", "", subtotal, "", ""]);
      grpRow.font = { bold: true };
      fillRow(grpRow, GREY);
      n += 1;

      for (const it of grp.rows) {
        ws.addRow([
          "",
          `    ${it.name}`,
          it.unit ?? "",
          it.actualQty ?? it.designQty ?? "",
          it.unitPrice ?? "",
          computeAmount(it),
          it.supplierName ?? "",
          it.note ?? "",
        ]);
      }
    }
  }

  const s = computeProfit(p.items, p.salePrice, p.area);
  ws.addRow([]);
  ws.addRow(["", "", "", "", "TỔNG CHI PHÍ", s.totalCost]).font = { bold: true };
  if (opts.showProfit) {
    ws.addRow(["", "", "", "", "Giá bán", s.salePrice]);
    ws.addRow(["", "", "", "", "Lợi nhuận", s.profit]).font = { bold: true };
  }

  ws.getColumn(4).numFmt = "#,##0.##";
  ws.getColumn(5).numFmt = "#,##0";
  ws.getColumn(6).numFmt = "#,##0";
  ws.columns.forEach((c) => {
    c.width = 15;
  });
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 32;

  return wb;
}
