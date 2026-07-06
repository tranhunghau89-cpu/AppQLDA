// Nhập đơn đặt hàng (mua hàng) từ các file Excel DH_*.xlsx.
// Mỗi file = 1 đơn (nhiều sheet vật tư) -> PurchaseOrder + PurchaseOrderItem.
// Chạy: npm run import:orders
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const HD_BASE =
  "D:\\OneDrive - Cong ty CP Xay dung Dubai-HM00095\\XDDubai_DataCenter\\2_DuAn\\RaDonHang";

// Thư mục MH của các dự án cần nhập.
const MH_DIRS = [
  HD_BASE + "\\26_0420_K16L20\\MH",
  HD_BASE + "\\26_0513_K17L27\\MH",
  HD_BASE + "\\26_0520_K10L54\\MH",
  HD_BASE + "\\26_0520_K20L30\\MH",
];

function norm(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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

interface POItem {
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
  row: number; // dòng nguồn (để gắn ảnh biên dạng)
  si: number; // chỉ số sheet
}

function cleanSheetName(sn: string): string {
  return sn.replace(/^\s*\d+\.\s*/, "").trim();
}

function parseSheet(
  ws: ExcelJS.Worksheet,
  sheetCat: string,
  startSort: number,
  si: number
): { items: POItem[]; headerRow: number } {
  // marker "ĐẶT HÀNG" trong vài hàng đầu
  let marker = false;
  for (let r = 1; r <= 8; r++) if (text(ws.getCell(r, 1).value).includes("ĐẶT HÀNG")) marker = true;
  if (!marker) return { items: [], headerRow: 0 };

  // tìm header row (cột A == STT)
  let hdr = 0;
  for (let r = 1; r <= 16; r++) {
    if (norm(ws.getCell(r, 1).value) === "stt") {
      hdr = r;
      break;
    }
  }
  if (!hdr) return { items: [], headerRow: 0 };

  const col: Record<string, number> = {};
  const maxC = Math.max(ws.columnCount, 12);
  for (let c = 1; c <= maxC; c++) {
    const n = norm(ws.getCell(hdr, c).value);
    if (!n) continue;
    if ((n.includes("tenhang") || n.includes("quycach")) && !col.name) col.name = c;
    else if (n === "sl" && !col.qty) col.qty = c;
    else if (n.includes("donvi") && !col.unit) col.unit = c;
    else if (n.includes("dongia") && !col.price) col.price = c;
    else if (n.includes("thanhtien") && !col.amount) col.amount = c;
    else if (n.includes("trongluong") && !col.weight) col.weight = c;
    else if (n.includes("ghichu") && !col.note) col.note = c;
  }
  const nameCol = col.name ?? 2;

  const items: POItem[] = [];
  let group: string | null = null;
  let sort = startSort;
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const aStr = text(ws.getCell(r, 1).value);
    const name = text(ws.getCell(r, nameCol).value);
    if (aStr.length === 1 && /[A-Za-z]/.test(aStr)) {
      group = name || group;
      continue;
    }
    if (aStr.toLowerCase().includes("tổng")) break;
    if (!name) {
      if (aStr && !/^\d+$/.test(aStr)) group = aStr; // tiêu đề mục (TON)
      continue;
    }
    const qty = col.qty ? num(ws.getCell(r, col.qty).value) : null;
    const weight = col.weight ? num(ws.getCell(r, col.weight).value) : null;
    if ((qty == null || qty === 0) && (weight == null || weight === 0)) continue;
    items.push({
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
  return { items, headerRow: hdr };
}

interface POImage {
  si: number;
  anchorRow: number;
  mime: string;
  buffer: Buffer;
  targetSort: number; // sortOrder của item được gắn
}

// Trích ảnh biên dạng (bỏ logo ở phía trên header).
function extractImages(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  si: number,
  headerRow: number
): POImage[] {
  const out: POImage[] = [];
  let imgs: ReturnType<ExcelJS.Worksheet["getImages"]>;
  try {
    imgs = ws.getImages();
  } catch {
    return out;
  }
  for (const im of imgs) {
    const tlRow = im.range?.tl?.row;
    if (typeof tlRow !== "number") continue;
    const anchorRow = Math.floor(tlRow) + 1;
    if (anchorRow < headerRow) continue; // logo / vùng đầu trang
    const media = wb.getImage(Number(im.imageId)) as { buffer?: Buffer; extension?: string };
    if (!media?.buffer) continue;
    out.push({
      si,
      anchorRow,
      mime: "image/" + (media.extension || "png"),
      buffer: media.buffer,
      targetSort: -1,
    });
  }
  return out;
}

// Danh mục chuẩn hóa: KCT | XA_GO | TON | VTP
function categoryOf(file: string): string {
  const n = norm(file);
  if (n.includes("kct") || n.includes("ketcau")) return "KCT";
  if (n.includes("xago") || n.includes("xg")) return "XA_GO";
  if (n.includes("dhton") || n.includes("ton")) return "TON";
  // BL, panel, cửa lùa, phụ kiện... gom về Vật tư phụ
  return "VTP";
}

function orderDateOf(stem: string): Date | null {
  const m = stem.match(/^(\d{2})_(\d{2})(\d{2})/);
  if (!m) return null;
  return new Date(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dims(s: string): string | null {
  const m = s.match(/(K\d+L\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

async function main() {
  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const byNorm = new Map(projects.map((p) => [norm(p.name), p]));

  const compFor: Record<string, string[]> = { KCT: ["KCT"], XA_GO: ["XA_GO"], TON: ["TON"], VTP: ["BLLK", "BL_NEO"] };

  console.log("\nFile".padEnd(34), "Dự án".padEnd(7), "Loại".padEnd(6), "Dòng", "  TL(kg)", " Ảnh", " NCC");
  console.log("-".repeat(96));

  let orders = 0, totalItems = 0, totalImages = 0;
  for (const dir of MH_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log("(thiếu thư mục)", dir);
      continue;
    }
    const files = fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && norm(f).includes("dh"));
    for (const f of files.sort()) {
      const stem = path.basename(f, ".xlsx");
      const category = categoryOf(f);
      const d = dims(stem);
      const project = d ? byNorm.get(norm(d)) : undefined;
      if (!project) {
        console.log(stem.slice(0, 33).padEnd(34), "KHÔNG KHỚP DỰ ÁN");
        continue;
      }

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(dir, f));
      const items: POItem[] = [];
      const images: POImage[] = [];
      let si = 0;
      wb.eachSheet((ws) => {
        const { items: found, headerRow } = parseSheet(ws, cleanSheetName(ws.name), items.length, si);
        items.push(...found);
        if (headerRow) images.push(...extractImages(wb, ws, si, headerRow));
        si++;
      });
      if (!items.length) continue;

      // gắn ảnh vào dòng vật tư gần nhất phía trên trong cùng sheet
      for (const img of images) {
        const cands = items.filter((it) => it.si === img.si);
        if (!cands.length) continue;
        const above = cands.filter((it) => it.row <= img.anchorRow);
        const target = above.length
          ? above.reduce((a, b) => (b.row > a.row ? b : a))
          : cands.reduce((a, b) => (b.row < a.row ? b : a));
        img.targetSort = target.sortOrder;
      }

      const value = items.reduce((s, i) => s + (i.amount ?? 0), 0);
      const totalWeight = items.reduce((s, i) => s + (i.weight ?? 0), 0);

      // NCC theo component của dự án
      let supplierId: string | null = null;
      const comps = compFor[category];
      if (comps) {
        const link = await db.projectSupplier.findFirst({
          where: { projectId: project.id, component: { in: comps } },
          select: { supplierId: true },
        });
        supplierId = link?.supplierId ?? null;
      }

      // idempotent: xoá đơn cùng dự án + loại rồi tạo lại
      await db.purchaseOrder.deleteMany({ where: { projectId: project.id, category } });
      const created = await db.purchaseOrder.create({
        data: {
          projectId: project.id,
          orderNo: stem,
          orderDate: orderDateOf(stem),
          category,
          supplierId,
          status: "ORDERED",
          orderedDate: orderDateOf(stem),
          value,
          totalWeight,
          filePath: path.join(dir, f),
          items: {
            create: items.map((i) => ({
              category: i.category,
              groupName: i.groupName,
              name: i.name,
              unit: i.unit,
              qty: i.qty,
              unitPrice: i.unitPrice,
              amount: i.amount,
              weight: i.weight,
              note: i.note,
              sortOrder: i.sortOrder,
            })),
          },
        },
      });

      // gắn ảnh biên dạng vào item theo sortOrder
      let nImg = 0;
      const matched = images.filter((im) => im.targetSort >= 0);
      if (matched.length) {
        const createdItems = await db.purchaseOrderItem.findMany({
          where: { orderId: created.id },
          select: { id: true, sortOrder: true },
        });
        const bySort = new Map(createdItems.map((it) => [it.sortOrder, it.id]));
        for (const im of matched) {
          const itemId = bySort.get(im.targetSort);
          if (!itemId) continue;
          await db.poItemImage.create({
            data: { itemId, mime: im.mime, data: Uint8Array.from(im.buffer), sortOrder: nImg },
          });
          nImg++;
        }
      }

      orders++;
      totalItems += items.length;
      totalImages += nImg;
      console.log(
        stem.slice(0, 33).padEnd(34),
        project.code.padEnd(7),
        category.padEnd(6),
        String(items.length).padStart(4),
        totalWeight.toFixed(0).padStart(8),
        String(nImg).padStart(4),
        supplierId ? " ✓" : " —"
      );
    }
  }
  console.log(`\nXong. Đơn: ${orders} | Dòng vật tư: ${totalItems} | Ảnh biên dạng: ${totalImages}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
