// Nhập báo giá chi tiết mẫu (sheet "BG CT") thành 1 Quote trên dự án demo.
// Giữ nguyên đơn giá bán & giá gốc thật trong file, markup=1.2.
// Chạy: npm run import:quote
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const FILE =
  "D:\\OneDrive - Cong ty CP Xay dung Dubai-HM00095\\XDDubai_DataCenter\\2_DuAn\\RaDonHang\\@CN\\BG_NX_KL_HN_D2504_23.xlsx";
const DEMO_CODE = "DEMO1";

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
function norm(s: string): string {
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.getWorksheet("BG CT");
  if (!ws) throw new Error("Không tìm thấy sheet BG CT");

  // --- Header báo giá (label cột B, value cột D) ---
  const header: Record<string, string> = {};
  for (let r = 9; r <= 17; r++) {
    const label = norm(text(ws.getRow(r).getCell(2)));
    const val = text(ws.getRow(r).getCell(4)) || text(ws.getRow(r).getCell(3));
    if (!label || !val || label.length > 14) continue; // bỏ qua đoạn văn dài
    if (label.includes("kinhgui") && !header.recipient) header.recipient = val;
    else if (label.includes("duan") && !header.projectName) header.projectName = val;
    else if (label.includes("diadiem") && !header.location) header.location = val;
    else if (label.includes("hangmuc") && !header.scope) header.scope = val;
  }

  // --- Bảng: tìm header (cột A = STT) ---
  let headerRow = -1;
  for (let r = 40; r <= 60; r++) {
    if (norm(text(ws.getRow(r).getCell(1))) === "stt") {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) throw new Error("Không tìm thấy header bảng (STT)");

  interface ItemRow {
    workCode: string | null;
    name: string;
    unit: string | null;
    qty: number | null;
    sellPrice: number | null;
    baseCost: number | null;
    spec: string | null;
  }
  interface Sub {
    code: string;
    name: string;
    items: ItemRow[];
  }
  interface Phan {
    code: string;
    name: string;
    area: number | null;
    directItems: ItemRow[];
    subs: Sub[];
  }
  const phans: Phan[] = [];
  let curPhan: Phan | null = null;
  let curSub: Sub | null = null;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const stt = text(row.getCell(1));
    const name = text(row.getCell(2));
    if (norm(name).startsWith("congtruoc") || norm(name).startsWith("ghichu")) break;

    if (/^[A-F]$/.test(stt)) {
      curPhan = { code: stt, name, area: num(row.getCell(5)), directItems: [], subs: [] };
      curSub = null;
      phans.push(curPhan);
      continue;
    }
    if (/^(I{1,3}|IV|V)$/.test(stt)) {
      if (!curPhan) continue;
      curSub = { code: stt, name, items: [] };
      curPhan.subs.push(curSub);
      continue;
    }
    if (/^\d+$/.test(stt)) {
      if (!curPhan) continue;
      if (!name) continue;
      const item: ItemRow = {
        workCode: text(row.getCell(3)) || null,
        name,
        unit: text(row.getCell(4)) || null,
        qty: num(row.getCell(5)),
        sellPrice: num(row.getCell(6)),
        baseCost: num(row.getCell(10)),
        spec: text(row.getCell(8)) || null,
      };
      (curSub ? curSub.items : curPhan.directItems).push(item);
    }
  }

  // --- Ghi DB (idempotent) ---
  const projData = {
    name: header.projectName || "Báo giá mẫu",
    location: header.location || null,
    note: "Dự án demo chứa báo giá mẫu (import từ BG_NX_KL_HN).",
  };
  const project = await db.project.upsert({
    where: { code: DEMO_CODE },
    update: projData,
    create: { code: DEMO_CODE, status: "CHO", ...projData },
  });
  await db.quote.deleteMany({ where: { projectId: project.id } });

  const quote = await db.quote.create({
    data: {
      projectId: project.id,
      title: `Báo giá ${header.projectName || "mẫu"}`,
      recipient: header.recipient || null,
      location: header.location || null,
      scope: header.scope || null,
      markup: 1.2,
      note: "Bản mẫu — dùng để clone cho dự án thật.",
    },
  });

  let secSort = 0;
  let itemCount = 0;
  async function createItems(sectionId: string, items: ItemRow[]) {
    let s = 0;
    for (const it of items) {
      await db.quoteItem.create({
        data: {
          quoteId: quote.id,
          sectionId,
          workCode: it.workCode,
          name: it.name,
          unit: it.unit,
          qty: it.qty,
          baseCost: it.baseCost,
          sellPrice: it.sellPrice,
          spec: it.spec,
          sortOrder: s++,
        },
      });
      itemCount++;
    }
  }

  for (const p of phans) {
    const phanSec = await db.quoteSection.create({
      data: {
        quoteId: quote.id,
        code: p.code,
        name: p.name,
        kind: "PHAN",
        area: p.area,
        sortOrder: secSort++,
      },
    });
    await createItems(phanSec.id, p.directItems);
    for (const sub of p.subs) {
      const subSec = await db.quoteSection.create({
        data: {
          quoteId: quote.id,
          code: sub.code,
          name: sub.name,
          kind: "SUB",
          parentId: phanSec.id,
          sortOrder: secSort++,
        },
      });
      await createItems(subSec.id, sub.items);
    }
  }

  console.log(
    `Dự án ${project.code} — Quote "${quote.title}": ${phans.length} phần, ${itemCount} dòng.`
  );
  console.log("Phần: " + phans.map((p) => `${p.code}(${p.subs.length} mục)`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
