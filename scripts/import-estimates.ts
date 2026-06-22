// Nhập dự toán chi tiết từ các file Excel mẫu trong AppQLDA/DuToanMau/*.xlsx.
// Mỗi file = 1 dự án (sheet "TongHop"): cập nhật diện tích, giá bán và toàn bộ dòng dự toán.
// Chạy: npm run import:estimates
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DIR = path.resolve(process.cwd(), "..", "DuToanMau");

// ---------- đọc cell (xử lý formula cache của ExcelJS) ----------
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
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.result === "string") return o.result.trim();
    if (typeof o.result === "number") return String(o.result);
    if (o.text) return String(o.text).trim();
  }
  return "";
}

// ---------- chuẩn hoá tên để so khớp ----------
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // bỏ khoảng trắng & ký tự đặc biệt
}
function dims(fileBase: string): string | null {
  const m = fileBase.match(/^(K\d+L\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

// ---------- phân nhóm chi phí ----------
function classify(itemName: string, subName: string): string {
  const s = norm(itemName + " " + subName);
  if (s.includes("vanchuyen")) return "VAN_CHUYEN";
  if (s.includes("lapdung") || s.includes("lapdat") || s.includes("lop") || s.includes("nhancong"))
    return "NHAN_CONG";
  if (s.includes("xago")) return "XA_GO";
  if (s.includes("neo") || s.includes("maduong")) return "BL_NEO";
  if (s.includes("bulong") || s.includes("tyxa") || s.includes("lienket")) return "BLLK";
  if (
    s.includes("ton") || s.includes("diem") || s.includes("mang") || s.includes("ong") ||
    s.includes("vit") || s.includes("keo") || s.includes("phukien") || s.includes("phieu")
  )
    return "TON";
  if (s.includes("thep") || s.includes("ketcau")) return "KCT";
  if (s.includes("giang") || s.includes("cap") || s.includes("tangdo")) return "VT_PHU";
  return "KHAC";
}

const GROUP_LABEL: Record<string, string> = {
  A: "Khung mái", B: "Vách", C: "Canopy", D: "Nóc gió", E: "Dầm sàn",
};

interface Leaf {
  groupCode: string;
  name: string;
  unit: string | null;
  designQty: number | null;
  unitPrice: number | null;
  amount: number;
  note: string | null;
  sortOrder: number;
}

async function readWorkbook(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("TongHop");
  if (!ws) throw new Error(`${path.basename(file)}: không có sheet TongHop`);

  // diện tích = Σ D3:D7
  let area = 0;
  for (let r = 3; r <= 7; r++) {
    const d = num(ws.getCell(r, 4).value);
    if (d) area += d;
  }

  const leaves: Leaf[] = [];
  let curLetter: string | null = null;
  let curSub = "";
  let sort = 0;
  for (let r = 9; r <= ws.rowCount; r++) {
    const aText = text(ws.getCell(r, 1).value);
    const b = text(ws.getCell(r, 2).value);
    const f = num(ws.getCell(r, 6).value);

    if (/^[A-E]$/i.test(aText)) {
      curLetter = aText.toUpperCase();
      curSub = "";
      continue;
    }
    if (aText !== "") {
      // dòng mục (số thứ tự 1,2,3…) = subtotal -> bỏ qua, chỉ ghi nhớ tên
      curSub = b;
      continue;
    }
    // leaf: cột A trống
    if (b && f && f !== 0 && curLetter) {
      const unit = text(ws.getCell(r, 3).value) || null;
      const designQty = num(ws.getCell(r, 4).value);
      const unitPrice = num(ws.getCell(r, 5).value);
      const quyCach = text(ws.getCell(r, 8).value);
      const ghiChu = text(ws.getCell(r, 9).value);
      const ctx = [GROUP_LABEL[curLetter] ?? curLetter, curSub].filter(Boolean).join(" › ");
      const noteParts = [ctx, quyCach, ghiChu].filter(Boolean);
      leaves.push({
        groupCode: classify(b, curSub),
        name: b,
        unit,
        designQty,
        unitPrice,
        amount: f,
        note: noteParts.length ? noteParts.join(" — ") : null,
        sortOrder: sort++,
      });
    }
  }

  const total = leaves.reduce((s, l) => s + l.amount, 0);
  const j1 = num(ws.getCell(1, 10).value);
  const sale = j1 && total > 0 && j1 <= 10 * total ? j1 : null;
  return { area: area || null, sale, total, leaves };
}

async function main() {
  if (!fs.existsSync(DIR)) throw new Error(`Không thấy thư mục ${DIR}`);
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.includes("(1)"))
    .sort();

  // nạp toàn bộ dự án để khớp tên
  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const byNorm = new Map<string, { id: string; code: string; name: string }>();
  for (const p of projects) byNorm.set(norm(p.name), p);

  let newSeq = 1;
  const usedNewCodes = new Set(projects.map((p) => p.code));
  function nextCode(): string {
    let c = `DT${String(newSeq).padStart(2, "0")}`;
    while (usedNewCodes.has(c)) {
      newSeq++;
      c = `DT${String(newSeq).padStart(2, "0")}`;
    }
    usedNewCodes.add(c);
    newSeq++;
    return c;
  }

  console.log(`\nNguồn: ${DIR}\nSố file: ${files.length}\n`);
  console.log("File".padEnd(20), "Khớp dự án".padEnd(22), "Item", "  Tổng CP", "      Giá bán");
  console.log("-".repeat(78));

  for (const f of files) {
    const base = path.basename(f, ".xlsx");
    const { area, sale, total, leaves } = await readWorkbook(path.join(DIR, f));

    // khớp: 1) tên đầy đủ  2) bare-dims đúng bằng
    let target = byNorm.get(norm(base));
    let how = "tên đầy đủ";
    if (!target) {
      const d = dims(base);
      if (d) {
        const cand = byNorm.get(norm(d));
        if (cand) {
          target = cand;
          how = `dims ${d}`;
        }
      }
    }

    let project = target;
    if (!project) {
      const code = nextCode();
      project = await db.project.create({ data: { code, name: base } });
      byNorm.set(norm(base), project);
      how = "TẠO MỚI";
    }

    // cập nhật area + salePrice
    const upd: { area?: number; salePrice?: number } = {};
    if (area != null) upd.area = area;
    if (sale != null) upd.salePrice = sale;
    if (Object.keys(upd).length) await db.project.update({ where: { id: project.id }, data: upd });

    // thay toàn bộ item (idempotent)
    await db.estimateItem.deleteMany({ where: { projectId: project.id } });
    if (leaves.length) {
      await db.estimateItem.createMany({
        data: leaves.map((l) => ({ projectId: project!.id, ...l })),
      });
    }

    const label = `${project.code} ${how === "TẠO MỚI" ? "(mới)" : how}`;
    console.log(
      base.padEnd(20),
      label.padEnd(22),
      String(leaves.length).padStart(4),
      total.toLocaleString("vi-VN").padStart(14),
      (sale ? sale.toLocaleString("vi-VN") : "—").padStart(14)
    );
  }

  const totalItems = await db.estimateItem.count();
  console.log(`\nXong. Tổng EstimateItem trong DB: ${totalItems}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
