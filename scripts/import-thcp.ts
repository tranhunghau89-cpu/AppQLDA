// Nhập bảng Tổng hợp chi phí (quyết toán thực tế) từ AppQLDA/THCPMau/*.xlsx.
// Mỗi file = 1 dự án -> CostSummary + CostCategory (A-K) + CostItem.
// Chạy: npm run import:thcp
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DIR =
  "D:\\OneDrive - Cong ty CP Xay dung Dubai-HM00095\\XDDubai_DataCenter\\AppQLDA\\THCPMau";

const FILES = [
  "THCP 19X42 Hà Nam.xlsx",
  "THCP 20x20 Ninh Binh.xlsx",
  "thcp 20x50 ba vi.xlsx",
  "THCP 36x63 Tay Ninh.xlsx",
];

// A-K -> nhóm ESTIMATE_GROUP + nhãn
const CAT: Record<string, { group: string; label: string }> = {
  A: { group: "KCT", label: "Kết cấu thép" },
  B: { group: "XA_GO", label: "Xà gồ" },
  C: { group: "TON", label: "Tôn - Diềm" },
  D: { group: "BL_NEO", label: "Bulong neo" },
  E: { group: "BLLK", label: "BLLK" },
  F: { group: "VT_PHU", label: "Vật tư phụ" },
  G: { group: "NHAN_CONG", label: "Lắp dựng" },
  H: { group: "VAN_CHUYEN", label: "Vận chuyển" },
  I: { group: "MAY", label: "Máy" },
  K: { group: "KHAC", label: "Khác" },
};

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

interface Cat {
  code: string;
  name: string;
  supplier: string | null;
  value: number | null;
  payment: number | null;
  invoice: number | null;
}
interface Item {
  cat: string;
  name: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  ref: string | null;
  note: string | null;
}

function parse(ws: ExcelJS.Worksheet) {
  const C = (r: number, c: number) => ws.getCell(r, c).value;
  // Thông tin DA
  let dims = "",
    location = "",
    customer = "";
  for (let r = 1; r <= 8; r++) {
    const b = norm(C(r, 2));
    if (b.includes("cdt") || b.includes("kh")) customer = customer || text(C(r, 3));
    if (b.includes("kichthuoc")) dims = text(C(r, 4)) || text(C(r, 3));
    if (b.includes("vitri")) location = text(C(r, 4)) || text(C(r, 3));
  }

  // Tài chính
  let revenue: number | null = null,
    cost: number | null = null,
    profit: number | null = null,
    extraVat: number | null = null,
    paid: number | null = null,
    collected: number | null = null,
    receivable: number | null = null,
    collectionNote: string | null = null;
  for (let r = 8; r <= 16; r++) {
    const b = norm(C(r, 2));
    if (!b) continue;
    if (b.includes("doanhthu")) revenue = num(C(r, 3));
    else if (b.includes("chiphi")) cost = num(C(r, 3));
    else if (b === "lntt" || b.includes("lntt")) profit = num(C(r, 3));
    else if (b.includes("vatduocnhanthem")) extraVat = num(C(r, 3));
    // cột D=Đã Chi, E=Đã Thu, G=Còn phải thu (nằm ở dòng Doanh Thu hoặc Chi phí)
    if (b.includes("doanhthu") || b.includes("chiphi")) {
      if (paid == null) paid = num(C(r, 4));
      if (collected == null) collected = num(C(r, 5));
      const g = C(r, 7);
      if (num(g) != null && receivable == null) receivable = num(g);
      else if (!collectionNote && text(g)) collectionNote = text(g);
    }
  }

  // Tổng hợp hạng mục: header có C="NCC"
  const cats: Cat[] = [];
  let sumHdr = 0;
  for (let r = 1; r <= 30; r++) {
    if (norm(C(r, 3)).includes("ncc") && norm(C(r, 2)).includes("hangmuc")) {
      sumHdr = r;
      break;
    }
  }
  if (sumHdr) {
    for (let r = sumHdr + 1; r <= sumHdr + 14; r++) {
      const a = text(C(r, 1)).trim().toUpperCase();
      if (!/^[A-K]$/.test(a)) {
        if (norm(C(r, 1)).includes("chitiet")) break;
        continue;
      }
      cats.push({
        code: a,
        name: text(C(r, 2)) || CAT[a]?.label || a,
        supplier: text(C(r, 3)) || null,
        value: num(C(r, 4)),
        payment: num(C(r, 5)),
        invoice: num(C(r, 6)),
      });
    }
  }

  // Chi tiết chi phí
  const items: Item[] = [];
  let detHdr = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    if (norm(C(r, 1)).includes("chitietchiphi")) {
      detHdr = r + 1; // dòng header "Hạng Mục"
      break;
    }
  }
  if (detHdr) {
    let cur = "";
    let blanks = 0;
    for (let r = detHdr + 1; r <= ws.rowCount; r++) {
      const a = text(C(r, 1)).trim().toUpperCase();
      const name = text(C(r, 2));
      const qty = num(C(r, 3)),
        price = num(C(r, 4)),
        amount = num(C(r, 5));
      if (!a && !name && qty == null && price == null && amount == null) {
        if (++blanks > 20) break;
        continue;
      }
      blanks = 0;
      if (/^[A-K]$/.test(a)) {
        cur = a; // dòng nhóm (subtotal) — bỏ qua làm item
        continue;
      }
      if (cur && name && (qty != null || price != null || amount != null)) {
        items.push({
          cat: cur,
          name,
          qty,
          unitPrice: price,
          amount,
          ref: text(C(r, 6)) || null,
          note: text(C(r, 7)) || null,
        });
      }
    }
  }

  return {
    dims,
    location,
    customer,
    fin: { revenue, cost, profit, extraVat, paid, collected, receivable, collectionNote },
    cats,
    items,
  };
}

function dimsCore(s: string): string | null {
  const m = s.match(/K\s*\d+\s*L\s*\d+/i);
  return m ? m[0].replace(/\s+/g, "").toUpperCase() : null;
}
function dimNums(s: string): { k: number | null; l: number | null } {
  const m = s.match(/K\s*(\d+)\s*L\s*(\d+)/i);
  return m ? { k: Number(m[1]), l: Number(m[2]) } : { k: null, l: null };
}

async function main() {
  const projects = await db.project.findMany({
    select: { id: true, code: true, name: true, location: true },
  });

  let nextN = Math.max(
    0,
    ...projects.map((p) => {
      const m = p.code.match(/^N(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
  );

  console.log("\nFile".padEnd(30), "DA".padEnd(20), "Doanh thu".padStart(15), "Chi phí".padStart(15), "LNTT".padStart(15), "Nhóm", "Dòng");
  console.log("-".repeat(120));

  for (const f of FILES) {
    const fp = path.join(DIR, f);
    if (!fs.existsSync(fp)) {
      console.log("(thiếu)", f);
      continue;
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fp);
    const d = parse(wb.worksheets[0]);

    const core = dimsCore(d.dims) || dimsCore(f) || "";
    // 1) khớp tên đầy đủ; 2) khớp dims + tỉnh; 3) tạo mới
    let project =
      projects.find((p) => norm(p.name) === norm(d.dims)) ||
      projects.find(
        (p) =>
          core &&
          norm(p.name).includes(norm(core)) &&
          norm(p.location || "").length > 0 &&
          (norm(p.location || "").includes(norm(d.location)) ||
            norm(d.location).includes(norm(p.location || "")))
      );

    let how = project ? "khớp" : "TẠO MỚI";
    if (!project) {
      // customer
      let customerId: string | null = null;
      if (d.customer) {
        const cu =
          (await db.customer.findFirst({ where: { name: d.customer } })) ??
          (await db.customer.create({ data: { name: d.customer } }));
        customerId = cu.id;
      }
      nextN += 1;
      const code = "N" + String(nextN).padStart(3, "0");
      const { k, l } = dimNums(d.dims || core);
      const created = await db.project.create({
        data: {
          code,
          name: d.dims || core,
          location: d.location || null,
          customerId,
          kK: k,
          kL: l,
          status: "HOAN_THANH",
        },
        select: { id: true, code: true, name: true, location: true },
      });
      projects.push(created);
      project = created;
      how = "TẠO MỚI " + code;
    }

    // idempotent
    await db.costSummary.deleteMany({ where: { projectId: project.id } });

    const catCodes = Array.from(
      new Set([...d.cats.map((c) => c.code), ...d.items.map((i) => i.cat)])
    ).sort();

    const summary = await db.costSummary.create({
      data: {
        projectId: project.id,
        revenue: d.fin.revenue,
        cost: d.fin.cost,
        profit: d.fin.profit,
        extraVat: d.fin.extraVat,
        paidWithVat: d.fin.paid,
        collectedWithVat: d.fin.collected,
        receivable: d.fin.receivable,
        collectionNote: d.fin.collectionNote,
        filePath: fp,
      },
    });

    let sortC = 0;
    for (const code of catCodes) {
      const cs = d.cats.find((c) => c.code === code);
      const cat = await db.costCategory.create({
        data: {
          summaryId: summary.id,
          code,
          groupCode: CAT[code]?.group || "KHAC",
          name: cs?.name || CAT[code]?.label || code,
          supplier: cs?.supplier ?? null,
          value: cs?.value ?? null,
          payment: cs?.payment ?? null,
          invoice: cs?.invoice ?? null,
          sortOrder: sortC++,
        },
      });
      const its = d.items.filter((i) => i.cat === code);
      let sortI = 0;
      for (const it of its) {
        await db.costItem.create({
          data: {
            categoryId: cat.id,
            name: it.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
            amount: it.amount,
            ref: it.ref,
            note: it.note,
            sortOrder: sortI++,
          },
        });
      }
    }

    // cập nhật giá bán = doanh thu (dashboard)
    if (d.fin.revenue != null)
      await db.project.update({ where: { id: project.id }, data: { salePrice: d.fin.revenue } });

    console.log(
      f.slice(0, 29).padEnd(30),
      `${project.code} ${how}`.slice(0, 20).padEnd(20),
      (d.fin.revenue ?? 0).toLocaleString("vi").padStart(15),
      (d.fin.cost ?? 0).toLocaleString("vi").padStart(15),
      (d.fin.profit ?? 0).toLocaleString("vi").padStart(15),
      String(catCodes.length).padStart(4),
      String(d.items.length).padStart(4)
    );
  }
  console.log("\nXong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
