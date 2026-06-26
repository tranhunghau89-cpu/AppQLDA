// Nhập Bảng danh mục công việc & đơn giá (catalog Mã CV) từ sheet "DV"
// của file BG_NX_KL_HN_D2504_23.xlsx -> WorkPrice (idempotent theo code).
// Chạy: npm run import:pricebook
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const FILE =
  "D:\\OneDrive - Cong ty CP Xay dung Dubai-HM00095\\XDDubai_DataCenter\\2_DuAn\\RaDonHang\\@CN\\BG_NX_KL_HN_D2504_23.xlsx";

function num(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as { result?: unknown };
    if (typeof o.result === "number") return o.result;
  }
  return null;
}
function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.result === "string") return o.result.trim();
    if (typeof o.text === "string") return o.text.trim();
  }
  return "";
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.getWorksheet("DV");
  if (!ws) throw new Error("Không tìm thấy sheet DV");

  const rows: {
    code: string;
    name: string;
    shortName: string | null;
    spec: string | null;
    unit: string | null;
    groupCode: string;
    material: number | null;
    laborMachine: number | null;
    coefficient: number | null;
    baseCost: number | null;
    note: string | null;
    sortOrder: number;
  }[] = [];

  let sort = 0;
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = text(row.getCell(2)); // B = MCV
    if (!/^[A-Z]{2}\.\d/.test(code)) continue;
    const name = text(row.getCell(3)) || text(row.getCell(4)) || code; // C = ND
    const material = num(row.getCell(7)); // G = VT
    const laborMachine = num(row.getCell(8)); // H = NC_M
    const coefficient = num(row.getCell(9)); // I = HS
    let baseCost = num(row.getCell(10)); // J = GT
    if (baseCost == null && (material != null || laborMachine != null)) {
      baseCost = ((material ?? 0) + (laborMachine ?? 0)) * (coefficient ?? 1);
    }
    rows.push({
      code,
      name,
      shortName: text(row.getCell(4)) || null, // D = Loại
      spec: text(row.getCell(5)) || null, // E = TSKT
      unit: text(row.getCell(6)) || null, // F = DV
      groupCode: code.slice(0, 2).toUpperCase(),
      material,
      laborMachine,
      coefficient,
      baseCost,
      note: text(row.getCell(11)) || null, // K = GC
      sortOrder: sort++,
    });
  }

  let created = 0;
  let updated = 0;
  for (const d of rows) {
    const existing = await db.workPrice.findUnique({ where: { code: d.code } });
    if (existing) {
      await db.workPrice.update({ where: { code: d.code }, data: d });
      updated++;
    } else {
      await db.workPrice.create({ data: d });
      created++;
    }
  }

  const byGroup: Record<string, number> = {};
  for (const d of rows) byGroup[d.groupCode] = (byGroup[d.groupCode] ?? 0) + 1;
  console.log(`WorkPrice: ${rows.length} mã (tạo ${created}, cập nhật ${updated}).`);
  console.log(
    "Nhóm: " +
      Object.entries(byGroup)
        .sort()
        .map(([g, n]) => `${g}=${n}`)
        .join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
