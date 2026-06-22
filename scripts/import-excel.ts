// Nhập dữ liệu từ TD_DA.xlsx (sheet TongHop) vào DB.
// Chạy: npm run import
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// File Excel nằm ở thư mục cha (AppQLDA) của qlda-web.
const EXCEL_PATH = path.resolve(process.cwd(), "..", "TD_DA.xlsx");

// Cột NCC -> component.
const SUPPLIER_COLS: { col: number; component: string }[] = [
  { col: 9, component: "BL_NEO" }, // I
  { col: 10, component: "KCT" }, // J
  { col: 11, component: "XA_GO" }, // K
  { col: 12, component: "BLLK" }, // L
  { col: 13, component: "TON" }, // M
  { col: 14, component: "LAP_DUNG" }, // N
];

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.text) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
  }
  return "";
}

function cellDate(v: ExcelJS.CellValue): Date | null {
  if (v instanceof Date) return v;
  const t = cellText(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapStatus(text: string): string {
  const s = text.toLowerCase();
  if (s.includes("chờ")) return "CHO";
  if (s.includes("shop")) return "SHOP";
  if (s.includes("công")) return "GIA_CONG"; // G. Công
  if (s.includes("dựng")) return "LAP_DUNG"; // L. Dựng
  if (s.includes("thành")) return "HOAN_THANH"; // H. Thành
  return "CHO";
}

const customerCache = new Map<string, string>();
async function getCustomerId(name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  if (customerCache.has(n)) return customerCache.get(n)!;
  let c = await db.customer.findFirst({ where: { name: n } });
  if (!c) c = await db.customer.create({ data: { name: n } });
  customerCache.set(n, c.id);
  return c.id;
}

const supplierCache = new Map<string, string>();
async function getSupplierId(name: string, category: string): Promise<string | null> {
  const n = name.trim();
  if (!n || n === "0") return null;
  const key = `${category}::${n}`;
  if (supplierCache.has(key)) return supplierCache.get(key)!;
  let s = await db.supplier.findFirst({ where: { name: n, category } });
  if (!s) s = await db.supplier.create({ data: { name: n, category } });
  supplierCache.set(key, s.id);
  return s.id;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.getWorksheet("TongHop");
  if (!ws) throw new Error("Không tìm thấy sheet TongHop");

  let imported = 0;
  const codeRe = /^N\d{2,3}$/i;

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = cellText(row.getCell(1).value);
    if (!codeRe.test(code)) continue;

    const statusText = cellText(row.getCell(2).value);
    const name = cellText(row.getCell(3).value) || code;
    const buildingType = cellText(row.getCell(4).value) || null;
    const customerName = cellText(row.getCell(5).value);
    const location = cellText(row.getCell(6).value) || null;
    const startDate = cellDate(row.getCell(7).value);

    const customerId = customerName ? await getCustomerId(customerName) : null;

    const data = {
      name,
      buildingType,
      status: mapStatus(statusText),
      location,
      customerId,
      startDate,
    };

    const project = await db.project.upsert({
      where: { code },
      update: data,
      create: { code, ...data },
    });

    // NCC theo hạng mục
    for (const { col, component } of SUPPLIER_COLS) {
      const supName = cellText(row.getCell(col).value);
      const supId = supName ? await getSupplierId(supName, component) : null;
      if (supId) {
        await db.projectSupplier.upsert({
          where: { projectId_component: { projectId: project.id, component } },
          update: { supplierId: supId },
          create: { projectId: project.id, component, supplierId: supId },
        });
      }
    }

    imported++;
  }

  const counts = {
    projects: await db.project.count(),
    customers: await db.customer.count(),
    suppliers: await db.supplier.count(),
  };
  console.log(`Đã nhập ${imported} dòng từ TongHop. Tổng:`, counts);
}

main()
  .catch((e) => {
    console.error("Lỗi import:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
