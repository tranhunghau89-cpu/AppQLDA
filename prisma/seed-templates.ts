// Seed 5 mẫu hạng mục dự toán (Khung mái, Vách, Canopy, Nóc gió, Dầm sàn).
// Cấu trúc + đơn giá + phân loại INPUT/DERIVED + tham số lấy từ bảng mẫu.
// Idempotent: xóa mẫu cùng code rồi tạo lại. Chạy: npm run db:seed:templates
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// L: 1 dòng mẫu. takes có → DERIVED; ngược lại INPUT. feeds → nạp KL vào tham số.
interface L {
  g: string; // groupLabel (nhóm cấp 2)
  n: string; // name
  u?: string; // unit
  p?: number; // defaultUnitPrice
  feeds?: string;
  takes?: string;
  gc: string; // groupCode (ESTIMATE_GROUP)
  note?: string;
}

interface T {
  code: string;
  name: string;
  lines: L[];
}

const TEMPLATES: T[] = [
  {
    code: "A",
    name: "Khung mái",
    lines: [
      { g: "Bulong neo", n: "Vật tư", u: "bộ", p: 80000, gc: "BL_NEO" },
      { g: "Bulong neo", n: "Vận chuyển", u: "chuyến", p: 800000, gc: "VAN_CHUYEN" },
      { g: "Bulong neo", n: "Lắp đặt", u: "bộ", p: 90000, gc: "NHAN_CONG" },
      { g: "Bulong neo", n: "Mã dưỡng", u: "cái", p: 80000, gc: "BL_NEO" },
      { g: "Kết cấu thép", n: "Thép tổ hợp", u: "kg", p: 20580, feeds: "KCT_KG", gc: "KCT", note: "Q355" },
      { g: "Kết cấu thép", n: "Thép hình", u: "kg", p: 23310, feeds: "KCT_KG", gc: "KCT", note: "SS400" },
      { g: "Kết cấu thép", n: "Xà gồ", u: "kg", p: 16636, feeds: "KCT_KG", gc: "XA_GO", note: "G350" },
      { g: "Bulong, ty xà gồ", n: "Bulong liên kết", u: "kg", p: 30909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ty xà gồ", u: "kg", p: 20909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ecu ty xà gồ", u: "kg", p: 23500, gc: "BLLK" },
      { g: "Giằng", n: "Cáp", u: "md", p: 18000, gc: "VT_PHU", note: "M14 bọc M16" },
      { g: "Giằng", n: "Ốc siết cáp", u: "cái", p: 9800, gc: "VT_PHU", note: "M18" },
      { g: "Giằng", n: "Tăng đơ", u: "cái", p: 40500, gc: "VT_PHU", note: "M20" },
      { g: "Giằng", n: "Ecu giằng", u: "cái", p: 1200, gc: "VT_PHU", note: "M16" },
      { g: "Bao che tôn", n: "Tôn mái", u: "m2", p: 102600, feeds: "TON_M2", gc: "TON", note: "0,45mm" },
      { g: "Bao che tôn", n: "Đai", u: "cái", gc: "VT_PHU" },
      { g: "Máng nước", n: "Vật tư máng", u: "md", p: 115000, gc: "TON", note: "K800" },
      { g: "Máng nước", n: "Phiễu thu", u: "cái", p: 20000, gc: "TON" },
      { g: "Máng nước", n: "Đai máng", u: "cái", p: 27500, gc: "TON" },
      { g: "Phụ kiện tôn", n: "Diềm", u: "md", p: 68000, gc: "TON", note: "K600" },
      { g: "Phụ kiện tôn", n: "Vít", u: "con", p: 375, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Keo", u: "chai", p: 60000, gc: "VT_PHU" },
      { g: "Ống thoát nước", n: "Ống", u: "md", p: 78320, gc: "VT_PHU" },
      { g: "Ống thoát nước", n: "Co, chếch", u: "cái", p: 63000, gc: "VT_PHU" },
      { g: "Ống thoát nước", n: "Đai ống", u: "cái", p: 4128, gc: "VT_PHU" },
      { g: "Ống thoát nước", n: "Keo", u: "kg", p: 180400, gc: "VT_PHU" },
      { g: "Ống thoát nước", n: "Cầu chắn rác", u: "cái", p: 70000, gc: "VT_PHU" },
      { g: "Vận chuyển", n: "Vận chuyển KCT", u: "kg", p: 1000, takes: "KCT_KG", gc: "VAN_CHUYEN" },
      { g: "Vận chuyển", n: "Vận chuyển tôn, phụ kiện", u: "m2", p: 10000, takes: "TON_M2", gc: "VAN_CHUYEN" },
      { g: "Lắp dựng", n: "Lắp dựng KCT", u: "kg", p: 1800, takes: "KCT_KG", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lợp tôn", u: "m2", p: 25000, takes: "TON_M2", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lắp phụ kiện", u: "md", p: 45000, gc: "NHAN_CONG" },
    ],
  },
  {
    code: "B",
    name: "Vách",
    lines: [
      { g: "Kết cấu thép", n: "Xà gồ", u: "kg", p: 16636, feeds: "KCT_KG", gc: "XA_GO" },
      { g: "Bulong, ty xà gồ", n: "Bulong liên kết", u: "kg", p: 30909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ty xà gồ", u: "kg", p: 20909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ecu ty xà gồ", u: "kg", p: 23500, gc: "BLLK" },
      { g: "Bao che tôn", n: "Tôn thường", u: "m2", p: 95040, feeds: "TON_M2", gc: "TON", note: "0,4mm" },
      { g: "Bao che tôn", n: "Tôn nhựa", u: "m2", p: 156600, feeds: "TON_M2", gc: "TON", note: "1,2mm" },
      { g: "Phụ kiện tôn", n: "Diềm", u: "md", p: 68000, gc: "TON" },
      { g: "Phụ kiện tôn", n: "Vít", u: "con", p: 375, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Keo", u: "chai", p: 60000, gc: "VT_PHU" },
      { g: "Vận chuyển", n: "Vận chuyển KCT", u: "kg", p: 1000, takes: "KCT_KG", gc: "VAN_CHUYEN" },
      { g: "Vận chuyển", n: "Vận chuyển tôn, phụ kiện", u: "m2", p: 10000, takes: "TON_M2", gc: "VAN_CHUYEN" },
      { g: "Lắp dựng", n: "Lắp dựng KCT", u: "kg", p: 1800, takes: "KCT_KG", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lợp tôn", u: "m2", p: 30000, takes: "TON_M2", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lắp phụ kiện", u: "md", p: 45000, gc: "NHAN_CONG" },
    ],
  },
  {
    code: "C",
    name: "Canopy",
    lines: [
      { g: "Kết cấu thép", n: "Thép tổ hợp", u: "kg", p: 20580, feeds: "KCT_KG", gc: "KCT" },
      { g: "Kết cấu thép", n: "Xà gồ", u: "kg", p: 16636, feeds: "KCT_KG", gc: "XA_GO" },
      { g: "Bulong, ty xà gồ", n: "Bulong liên kết", u: "kg", p: 30909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ty xà gồ", u: "kg", p: 20909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ecu ty xà gồ", u: "kg", p: 23500, gc: "BLLK" },
      { g: "Bao che tôn", n: "Tôn vòm", u: "m2", p: 109080, feeds: "TON_M2", gc: "TON" },
      { g: "Bao che tôn", n: "Tôn thẳng", u: "m2", p: 102600, feeds: "TON_M2", gc: "TON" },
      { g: "Phụ kiện tôn", n: "Diềm", u: "md", p: 68000, gc: "TON" },
      { g: "Phụ kiện tôn", n: "Vít", u: "con", p: 375, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Keo", u: "chai", p: 60000, gc: "VT_PHU" },
      { g: "Vận chuyển", n: "Vận chuyển KCT", u: "kg", p: 1000, takes: "KCT_KG", gc: "VAN_CHUYEN" },
      { g: "Vận chuyển", n: "Vận chuyển tôn, phụ kiện", u: "m2", p: 10000, takes: "TON_M2", gc: "VAN_CHUYEN" },
      { g: "Lắp dựng", n: "Lắp dựng KCT", u: "kg", p: 1800, takes: "KCT_KG", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lợp tôn", u: "m2", p: 25000, takes: "TON_M2", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lắp phụ kiện", u: "md", p: 45000, gc: "NHAN_CONG" },
    ],
  },
  {
    code: "D",
    name: "Nóc gió",
    lines: [
      { g: "Kết cấu thép", n: "Thép hình", u: "kg", p: 23310, feeds: "KCT_KG", gc: "KCT" },
      { g: "Kết cấu thép", n: "Xà gồ", u: "kg", p: 16636, feeds: "KCT_KG", gc: "XA_GO" },
      { g: "Bulong, ty xà gồ", n: "Bulong liên kết", u: "kg", p: 30909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ty xà gồ", u: "kg", p: 20909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Ecu ty xà gồ", u: "kg", p: 23500, gc: "BLLK" },
      { g: "Bao che tôn", n: "Tôn vòm", u: "m2", p: 109080, feeds: "TON_M2", gc: "TON", note: "0,45mm" },
      { g: "Bao che tôn", n: "Tôn thẳng", u: "m2", p: 102600, feeds: "TON_M2", gc: "TON", note: "0,45mm" },
      { g: "Phụ kiện tôn", n: "Diềm", u: "md", p: 68000, gc: "TON" },
      { g: "Phụ kiện tôn", n: "Vít", u: "con", p: 375, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Keo", u: "chai", p: 60000, gc: "VT_PHU" },
      { g: "Vận chuyển", n: "Vận chuyển KCT", u: "kg", p: 1000, takes: "KCT_KG", gc: "VAN_CHUYEN" },
      { g: "Vận chuyển", n: "Vận chuyển tôn, phụ kiện", u: "m2", p: 10000, takes: "TON_M2", gc: "VAN_CHUYEN" },
      { g: "Lắp dựng", n: "Lắp dựng KCT", u: "kg", p: 1800, takes: "KCT_KG", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lợp tôn", u: "m2", p: 25000, takes: "TON_M2", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lắp phụ kiện", u: "md", p: 25000, gc: "NHAN_CONG" },
    ],
  },
  {
    code: "E",
    name: "Dầm sàn",
    lines: [
      { g: "Kết cấu thép", n: "Thép tổ hợp", u: "kg", p: 20580, feeds: "KCT_KG", gc: "KCT" },
      { g: "Kết cấu thép", n: "Thép hình", u: "kg", p: 23310, feeds: "KCT_KG", gc: "KCT" },
      { g: "Bulong, ty xà gồ", n: "Bulong liên kết", u: "kg", p: 30909, gc: "BLLK" },
      { g: "Bulong, ty xà gồ", n: "Đinh chống cắt", u: "bộ", p: 7000, feeds: "DINH_BO", gc: "VT_PHU" },
      { g: "Bao che sàn", n: "Tôn Decking", u: "m2", p: 132000, feeds: "DECK_M2", gc: "TON" },
      { g: "Phụ kiện tôn", n: "Ke bo sàn", u: "md", p: 85000, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Chống ke bo sàn", u: "cái", p: 15000, gc: "VT_PHU" },
      { g: "Phụ kiện tôn", n: "Vít", u: "con", p: 1000, gc: "VT_PHU" },
      { g: "Vận chuyển", n: "Vận chuyển KCT", u: "kg", p: 1000, takes: "KCT_KG", gc: "VAN_CHUYEN" },
      { g: "Vận chuyển", n: "Vận chuyển tôn, phụ kiện", u: "m2", p: 10000, takes: "DECK_M2", gc: "VAN_CHUYEN" },
      { g: "Lắp dựng", n: "Lắp dựng KCT", u: "kg", p: 1800, takes: "KCT_KG", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Bắn đinh chống cắt", u: "bộ", p: 7500, takes: "DINH_BO", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lợp tôn", u: "m2", p: 25000, takes: "DECK_M2", gc: "NHAN_CONG" },
      { g: "Lắp dựng", n: "Lắp phụ kiện", u: "md", p: 45000, gc: "NHAN_CONG" },
    ],
  },
];

async function main() {
  for (let ti = 0; ti < TEMPLATES.length; ti++) {
    const t = TEMPLATES[ti];
    await db.estimateTemplate.deleteMany({ where: { code: t.code } });
    await db.estimateTemplate.create({
      data: {
        code: t.code,
        name: t.name,
        sortOrder: ti,
        active: true,
        lines: {
          create: t.lines.map((l, i) => ({
            groupLabel: l.g,
            name: l.n,
            unit: l.u ?? null,
            defaultUnitPrice: l.p ?? null,
            role: l.takes ? "DERIVED" : "INPUT",
            feedsParam: l.feeds ?? null,
            takesFromParam: l.takes ?? null,
            factor: 1,
            groupCode: l.gc,
            note: l.note ?? null,
            sortOrder: i,
          })),
        },
      },
    });
    console.log(`Seeded template ${t.code} — ${t.name} (${t.lines.length} dòng)`);
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => db.$disconnect());
