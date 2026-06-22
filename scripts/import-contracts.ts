// Nhập hợp đồng + báo giá theo hạng mục.
//  - 7 hợp đồng thật (đọc từ PDF scan/docx) -> status SIGNED, đầy đủ thông tin + link file.
//  - Báo giá theo hạng mục cho các dự án có file dự toán (Σ diện tích×đơn giá ở TongHop hàng 3-7) -> status QUOTE.
//  - Cập nhật project.salePrice = giá trị chưa VAT.
// Chạy: npm run import:contracts
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DUTOAN_DIR = path.resolve(process.cwd(), "..", "DuToanMau");
const HD_BASE =
  "D:\\OneDrive - Cong ty CP Xay dung Dubai-HM00095\\XDDubai_DataCenter\\2_DuAn\\RaDonHang";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Tìm file HĐ trong thư mục theo gợi ý (đã chuẩn hoá bỏ dấu).
function resolveFile(dir: string, hint: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(pdf|docx)$/i.test(f));
  const hit = files.find((f) => norm(f).includes(hint));
  return hit ? path.join(dir, hit) : null;
}

interface Item {
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  amount: number;
}
interface ContractSeed {
  code: string; // mã dự án đích
  contractNo: string;
  signDate: string; // ISO yyyy-mm-dd
  subject: string;
  partyAName: string;
  partyAInfo: string;
  vatPercent: number;
  paymentTerms: string;
  dir: string;
  hint: string;
  items: Item[];
}

const it = (name: string, unit: string, qty: number, unitPrice: number, amount: number): Item => ({
  name, unit, qty, unitPrice, amount,
});

const CONTRACTS: ContractSeed[] = [
  {
    code: "N047", contractNo: "0704/2026/HĐMB 628-DUBAI", signDate: "2026-04-07",
    subject: "Cung cấp vật tư nhà thép 26x112x7m",
    partyAName: "CÔNG TY TNHH TIẾN PHÁT 628",
    partyAInfo: "Thôn Đông, Xã Thanh Liêm, Tỉnh Ninh Bình · MST 0700862576 · ĐD: Bà Lê Thị Lợi (Giám đốc) · ĐT 0836589988",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 20% sau khi ký HĐ. Đợt 2: Thanh toán 80% còn lại khi nghiệm thu tại xưởng, trước khi giao hàng.",
    dir: HD_BASE + "\\@2026\\26_0410_K26L112\\HD", hint: "hdmb26x112",
    items: [it("Khung nhà thép mái SS400 + cột kèo + góc giật + xà gồ mái (R26×D112×C7m)", "m2", 2912, 470000, 1368640000)],
  },
  {
    code: "N053", contractNo: "0505/2026/HĐKT/THIENTRUC-DUBAI", signDate: "2026-05-05",
    subject: "Cung cấp và thi công lắp đặt nhà thép 17x27x7m",
    partyAName: "CHÙA THIÊN TRÚC",
    partyAInfo: "Thôn 2.13 Bảo Thắng, Tỉnh Lào Cai · ĐD: Đại đức Thích Chân Định (Trần Xuân Kiêm) · ĐT 0911752628",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 30% sau khi ký. Đợt 2: 40% khi tập kết kết cấu (trừ tôn mái). Đợt 3: 20% sau khi lắp tôn mái. Đợt 4: 10% còn lại khi nghiệm thu, xuất hóa đơn GTGT.",
    dir: HD_BASE + "\\26_0513_K17L27\\HD", hint: "thienchuc",
    items: [
      it("Khung cột kèo, xà gồ, tôn PU 0,45mm (Việt Hàn) mạ màu, máng nước xuống chân cột, vật tư phụ mới 100%", "m2", 459, 1000000, 459000000),
      it("Vách: xà gồ, tôn vách 1 lớp dày 0,40mm", "m2", 318, 300000, 95400000),
    ],
  },
  {
    code: "N050", contractNo: "1404/2026/HĐKT/TĐA-DUBAI", signDate: "2026-04-14",
    subject: "Cung cấp và thi công lắp đặt nhà xưởng 15x16x7m",
    partyAName: "Ông Trương Đình Anh",
    partyAInfo: "Xã Tủa Chùa, Tỉnh Điện Biên · ĐT 0983004008",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 30% sau khi ký. Đợt 2: 50% khi tập kết kết cấu (trừ tôn mái), bàn giao hàng. Đợt 3: 20% còn lại khi hoàn thành. Bảo hành 01 năm.",
    dir: HD_BASE + "\\26_0420_K16L20\\HD", hint: "dienbien",
    items: [
      it("Khung cũ sơn lại, xà gồ mái, tôn mái xốp 0,45mm Việt Hàn mạ màu, vật tư phụ mới 100%", "m2", 249, 950000, 236550000),
      it("Lắp dựng mái biên tôn 0,45mm", "m2", 72.22, 650000, 46943000),
      it("Vách: xà gồ, tôn vách dày 0,40mm", "m2", 265.5, 300000, 79650000),
      it("Cầu thang bộ 1,2m chưa lan can", "bộ", 1, 35000000, 35000000),
      it("Sàn khung cemboard dày 18mm", "m2", 76.2, 2000000, 152400000),
    ],
  },
  {
    code: "N048", contractNo: "0904/2026/HĐMB/KAMA-DUBAI", signDate: "2026-04-09",
    subject: "Cung cấp vật tư nhà thép 35x63x7m",
    partyAName: "CÔNG TY CỔ PHẦN SẢN XUẤT VẬT LIỆU XÂY DỰNG KAMA",
    partyAInfo: "Thôn Trường Thanh, Xã Trường Lâm, Tỉnh Thanh Hóa · MST 2803189236 · ĐD: Ông Nguyễn Xuân Giang (Giám đốc) · ĐT 0983277887",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 20% sau khi ký. Đợt 2: 60% khi nghiệm thu tại nhà máy. Đợt 3: 20% còn lại trước khi vận chuyển. Bảo hành 01 năm.",
    dir: HD_BASE + "\\26_0410_K20L68\\HD", hint: "kama",
    items: [it("Khung nhà thép mái SS400 + cột kèo + sơn lại + xà gồ mái mới (R35×D63×C7m)", "m2", 2205, 420000, 926100000)],
  },
  {
    code: "N049", contractNo: "1003/2026/HĐTC/HTX-DUBAI", signDate: "2026-03-14",
    subject: "Cung cấp, thi công lắp đặt nhà thép — Sân thể thao 538 Đường Láng 30x78x7m",
    partyAName: "HỢP TÁC XÃ THƯƠNG MẠI LÁNG HẠ",
    partyAInfo: "566 Đường Láng, Phường Láng, Hà Nội · MST 0100364642 · ĐD: Bà Lê Ánh Liên (CTHĐQT/Giám đốc) · ĐT 0981161618",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 40% sau khi ký. Đợt 2: 30% khi tập kết vật tư. Đợt 3: 15% khi lắp xong khung + tôn mái. Đợt 4: 13% khi hoàn thành; giữ lại 2% bảo hành 12 tháng.",
    dir: HD_BASE + "\\26_0315_PickLang\\HD", hint: "duonglang",
    items: [
      it("Khung cũ sơn lại, giằng, máng nước xuống chân cột, vật tư phụ mới 100%", "m2", 2131, 825000, 1758075000),
      it("Lắp đặt Panel 5cm 2 mặt tôn", "m2", 1195, 570000, 681150000),
      it("Cầu thang bộ 1,2m chưa lan can", "bộ", 1, 35000000, 35000000),
      it("Khung nhà 2 tầng", "m2", 187, 1900000, 355300000),
    ],
  },
  {
    code: "N045", contractNo: "3003/2026/HĐKT/PhuocAn-Dubai", signDate: "2026-03-03",
    subject: "Cung cấp và thi công lắp dựng nhà thép 21x34m",
    partyAName: "CÔNG TY TNHH XÂY DỰNG - SẢN XUẤT & THƯƠNG MẠI PHƯỚC AN",
    partyAInfo: "37-39 Cách Mạng Tháng Tám, P. Cẩm Thành, Tỉnh Quảng Ngãi · MST 4300898984 · ĐD: Ông Đỗ Tuyên Phước (Giám đốc) · ĐT 0555526526",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 20% sau khi ký. Đợt 2: 50% khi tập kết kết cấu (chưa gồm tôn). Đợt 3: 20% khi hoàn thành hạng mục. Đợt 4: 10% còn lại khi xuất hóa đơn GTGT.",
    dir: HD_BASE + "\\@2026\\26_0411_K21L34\\HD", hint: "quangngai",
    items: [it("Thi công lắp đặt hoàn thiện khung và mái tôn PU 0,5mm (có thể lắp cầu trục 3 tấn); 7 vì kèo, trụ, xà gồ, tôn, sơn, máng xối, ống thoát nước", "m2", 714, 950000, 678300000)],
  },
  {
    code: "N051", contractNo: "2104/2026/HĐKT/SONVIET-DUBAI", signDate: "2026-04-21",
    subject: "Cung cấp và thi công lắp đặt nhà thép 25x47x7m",
    partyAName: "CÔNG TY TNHH SƠN VIỆT",
    partyAInfo: "Khu 10, Xã Phù Ninh, Tỉnh Phú Thọ · MST 2600368279 · ĐD: Ông Vũ Ngọc Dũng (Giám đốc) · ĐT 0933588668",
    vatPercent: 8,
    paymentTerms: "Đợt 1: Tạm ứng 30% sau khi ký. Đợt 2: 30% khi tập kết kết cấu (chưa gồm tôn). Đợt 3: 20% khi lắp xong khung thép. Đợt 4: phần còn lại sau khi trừ 3% giữ bảo hành (12 tháng).",
    dir: HD_BASE + "\\@2026\\26_0421_K25L47\\HD", hint: "sonviet",
    items: [
      it("Khung cũ sơn lại, xà gồ, tôn mái 0,45mm, vật tư phụ mới 100%, máng nước xuống chân cột", "m2", 1175, 720000, 846000000),
      it("Vách: xà gồ, vật tư phụ, tôn dày 0,40mm", "m2", 306, 300000, 91800000),
      it("Vách Panel 5cm 2 mặt tôn dày 0,35mm", "m2", 217.5, 480000, 104400000),
    ],
  },
];

// ----- đọc báo giá theo hạng mục từ file dự toán (TongHop hàng 3-7) -----
function numCell(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const o = v as { result?: unknown };
    if (typeof o.result === "number") return o.result;
  }
  return null;
}
function textCell(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (typeof o.result === "string") return o.result.trim();
  }
  return "";
}

async function readBaoGia(file: string): Promise<Item[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("TongHop");
  if (!ws) return [];
  const items: Item[] = [];
  for (let r = 3; r <= 7; r++) {
    const name = textCell(ws.getCell(r, 2).value);
    const qty = numCell(ws.getCell(r, 4).value);
    const price = numCell(ws.getCell(r, 10).value); // cột J = đơn giá bán/m2
    if (name && qty && price) {
      items.push({ name, unit: textCell(ws.getCell(r, 3).value) || "m2", qty, unitPrice: price, amount: qty * price });
    }
  }
  return items;
}

function dims(base: string): string | null {
  const m = base.match(/^(K\d+L\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

async function main() {
  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const byCode = new Map(projects.map((p) => [p.code, p]));
  const byNorm = new Map(projects.map((p) => [norm(p.name), p]));

  const contractCodes = new Set(CONTRACTS.map((c) => c.code));
  let signed = 0, quoted = 0, fileMissing = 0;

  console.log("\nDự án".padEnd(8), "Loại".padEnd(8), "Số HĐ / báo giá".padEnd(32), "Chưa VAT".padStart(16), " File");
  console.log("-".repeat(96));

  // ---- 1) 7 hợp đồng đã ký ----
  for (const c of CONTRACTS) {
    const project = byCode.get(c.code);
    if (!project) { console.log(c.code, "KHÔNG THẤY DỰ ÁN"); continue; }
    const beforeVat = c.items.reduce((s, i) => s + i.amount, 0);
    const withVat = Math.round(beforeVat * (1 + c.vatPercent / 100));
    const filePath = resolveFile(c.dir, c.hint);
    if (!filePath) fileMissing++;

    await db.contract.deleteMany({ where: { projectId: project.id } });
    await db.contract.create({
      data: {
        projectId: project.id,
        contractNo: c.contractNo,
        signDate: new Date(c.signDate),
        subject: c.subject,
        partyAName: c.partyAName,
        partyAInfo: c.partyAInfo,
        valueBeforeVat: beforeVat,
        vatPercent: c.vatPercent,
        valueWithVat: withVat,
        paymentTerms: c.paymentTerms,
        filePath,
        status: "SIGNED",
        items: { create: c.items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      },
    });
    await db.project.update({ where: { id: project.id }, data: { salePrice: beforeVat } });
    signed++;
    console.log(
      c.code.padEnd(8), "Đã ký".padEnd(8), c.contractNo.padEnd(32),
      beforeVat.toLocaleString("vi-VN").padStart(16), filePath ? " ✓" : " (thiếu file)"
    );
  }

  // ---- 2) báo giá từ dự toán cho các dự án còn lại ----
  const files = fs.existsSync(DUTOAN_DIR)
    ? fs.readdirSync(DUTOAN_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx") && !f.includes("(1)"))
    : [];
  for (const f of files.sort()) {
    const base = path.basename(f, ".xlsx");
    let project = byNorm.get(norm(base));
    if (!project) {
      const d = dims(base);
      if (d) project = byNorm.get(norm(d));
    }
    if (!project || contractCodes.has(project.code)) continue; // đã có HĐ ký -> bỏ

    const items = await readBaoGia(path.join(DUTOAN_DIR, f));
    if (!items.length) continue;
    const beforeVat = items.reduce((s, i) => s + i.amount, 0);

    await db.contract.deleteMany({ where: { projectId: project.id } });
    await db.contract.create({
      data: {
        projectId: project.id,
        subject: `Báo giá ${base}`,
        valueBeforeVat: beforeVat,
        vatPercent: 8,
        valueWithVat: Math.round(beforeVat * 1.08),
        status: "QUOTE",
        items: { create: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
      },
    });
    await db.project.update({ where: { id: project.id }, data: { salePrice: beforeVat } });
    quoted++;
    console.log(
      project.code.padEnd(8), "Báo giá".padEnd(8), base.padEnd(32),
      beforeVat.toLocaleString("vi-VN").padStart(16), ""
    );
  }

  const total = await db.contract.count();
  console.log(`\nXong. Đã ký: ${signed} | Báo giá: ${quoted} | Tổng hợp đồng: ${total}` +
    (fileMissing ? ` | THIẾU FILE: ${fileMissing}` : ""));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
