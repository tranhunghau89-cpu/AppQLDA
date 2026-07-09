// Import 55 dự án còn thiếu (2024, 6T đầu/cuối 2025, 6T đầu 2026) — dữ liệu nhúng sẵn.
// Chạy: npx tsx scripts/import-missing-projects.ts  (hoặc npm run import:missing)
// Idempotent: chạy lại chỉ cập nhật theo mã, không tạo trùng.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface Row {
  code: string; name: string; cdt: string | null; loc: string | null;
  start: string | null; end: string | null; status: string; note: string | null;
}

const ROWS: Row[] = [
  { code: "D24-01", name: "K22L48_TB", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-02", name: "K22L69_TB", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-03", name: "K22L70_QN", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-04", name: "K18L32_DB", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-05", name: "K20L30_DB", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-06", name: "K22L48_DB", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-07", name: "K29L46_Lao", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-08", name: "K8L16_SL", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-09", name: "K21L30_BT", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-10", name: "San_BG", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-11", name: "K18L26_DL", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-12", name: "K21L35_DL", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-13", name: "K20L54_DK", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D24-14", name: "K12L22,5_BV", cdt: null, loc: null, start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-01", name: "K26L47_BG", cdt: "Duy Khánh", loc: "Tân Yên, Bắc Giang", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-02", name: "K10L18_LA", cdt: "TMDV Hùng Thịnh", loc: "Cần Giuộc, Long An", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-03", name: "K30L80_HN", cdt: "VLXD Hà Nam", loc: "Kim Bảng, Hà Nam", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-04", name: "K12L32_BN", cdt: "DTBIKE", loc: "Từ Sơn, Bắc Ninh", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-05", name: "K11L33_KT", cdt: "Ngọc Thăng", loc: "Ngọc Hồi, Kon Tum", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-06", name: "K18L131_BG", cdt: "Duy Khánh", loc: "Tân Yên, Bắc Giang", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-07", name: "K10L32_DN", cdt: "SXTM Duy Quang", loc: "Biên Hòa, Đồng Nai", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-08", name: "K36L84_TH", cdt: "Cát Ngọc Đạt- BÌNH MINH NGHĨA", loc: "Hà Trung, Thanh Hóa", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-09", name: "K20L36_HP", cdt: "Bùi Quang Thuật", loc: "An Dương, Hải Phòng", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-10", name: "K20L50_BT", cdt: "Habbi", loc: "Đức Linh, Bình Thuận", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-11", name: "K16L30_KT", cdt: "Phạm Văn Tùng", loc: "Sa Thầy, Kon Tum", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-12", name: "K22L36_HT", cdt: "Võ Tá Cầm", loc: "Hà Tĩnh", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-13", name: "K20L35_KH", cdt: "Du Lịch SonHa", loc: "Nha Trang, Khánh Hòa", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-14", name: "K36L78_BL", cdt: "Thiện Thảo", loc: "Giá Rai, Bạc Liêu", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-15", name: "K15L17_LC", cdt: "Đoàn Xuân Trường", loc: "Lào Cai", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-16", name: "K30L48_LC", cdt: "Bảo Hà", loc: "Lào Cai", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-17", name: "K15L30_BG", cdt: "Dương Tấn Tài", loc: "Lục Nam, Bắc Giang", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-18", name: "K19L34_HP", cdt: "Trịnh Đình Lương", loc: "An Dương, Hải Phòng", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-19", name: "K20L60_HG", cdt: "Sun Vina", loc: "Vị Yên, Hà Giang", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-20", name: "K32L80_Lao", cdt: "Trần Gia", loc: "Viên Chăn, Lào", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-21", name: "K14x60_DB", cdt: "Biên Huyền", loc: "Điện Biên", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-22", name: "K19L40_BP", cdt: "Phạm Tấn Hùng", loc: "Đăk Nông", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-23", name: "K18L30_TQ", cdt: "Võ Thế Trường", loc: "Tuyên Quang", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-24", name: "K15L40_HT", cdt: "Phan Công Đức", loc: "Hà Tĩnh", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-25", name: "K15L30_BT", cdt: "Kegalighhouse", loc: "Bình Thuận", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-26", name: "K10L22_DB", cdt: "Long Lâm", loc: "Điện Biên", start: null, end: null, status: "HOAN_THANH", note: "Chưa có trong danh sách (khác K10L25_DB đã có); không có dữ liệu ngày" },
  { code: "D25A-27", name: "K16L54_HD", cdt: "Quý Cao", loc: "Hải Dương", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-28", name: "K12L25_TH", cdt: null, loc: "Thanh Hóa", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-29", name: "K29L35_DL", cdt: null, loc: "Đăk Lăk", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-30", name: "K20L31_DB", cdt: "Long Lâm", loc: "Điện Biên", start: null, end: null, status: "HOAN_THANH", note: "Chưa có trong danh sách (khác K10L25_DB đã có); không có dữ liệu ngày" },
  { code: "D25A-31", name: "K30L44_LA", cdt: "Lê Nam", loc: "Đức Hòa, Long An", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-32", name: "K32L41_ĐN", cdt: "CĐ1", loc: "Đắk Nông", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-33", name: "K20L45_NT", cdt: "Chùa Tuyền Lâm", loc: "Cam Ranh, Khánh Hòa", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-34", name: "K29L55_HN", cdt: "Nguyễn Thành Đạt", loc: "Gia Lâm, Hà Nội", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-35", name: "K19L23_BN", cdt: "Nguyễn Thắng BĐS", loc: "Quế Võ, Bắc Ninh", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-36", name: "K17L48_HN", cdt: "Hoàng Hải Dương", loc: "Hoàng Mai, Hà Nội", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-37", name: "K37L34_BN", cdt: "Hưng Phát Vina", loc: "Quế Võ, Bắc Ninh", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25A-38", name: "K36L85_BP", cdt: "Hà Mỵ", loc: "Đồng Phú, Bình Phước", start: null, end: null, status: "HOAN_THANH", note: null },
  { code: "D25B-01", name: "K17L48_HN", cdt: "Mỹ Đức", loc: "Hà Nội", start: "2025-08-18", end: "2025-08-28", status: "HOAN_THANH", note: null },
  { code: "D25B-02", name: "K30L80_NĐ", cdt: "Cty Bình Minh", loc: "Nam Định", start: "2025-07-15", end: "2025-07-31", status: "HOAN_THANH", note: null },
  { code: "D26-01", name: "3 Ha", cdt: "Duy Khánh", loc: "Bắc Giang", start: "2026-06-02", end: null, status: "GIA_CONG", note: "Chưa có trong danh sách; ngày ký HĐ muộn hơn ngày KT trong file gốc - có thể do nhập liệu, bạn kiểm tra lại giúp · Ngày KT trong file gốc sớm hơn ngày BĐ — cần kiểm tra lại" },
  { code: "D26-02", name: "K17L27_NA", cdt: "Chùa Chí Linh", loc: "Nghệ An", start: "2026-05-29", end: null, status: "GIA_CONG", note: "Chưa có trong danh sách; chưa có ngày KT/xuất HĐ trong file gốc" },
  { code: "D26-03", name: "K40L70_NA", cdt: "QTP", loc: "Nghệ An", start: "2026-03-24", end: "2026-05-14", status: "GIA_CONG", note: "Chưa có trong danh sách; chưa có ngày KT/xuất HĐ trong file gốc" },
];

async function main() {
  let created = 0, updated = 0, customers = 0;
  for (const r of ROWS) {
    let customerId: string | null = null;
    if (r.cdt) {
      let c = await db.customer.findFirst({ where: { name: r.cdt } });
      if (!c) {
        c = await db.customer.create({ data: { name: r.cdt } });
        customers++;
      }
      customerId = c.id;
    }
    const data = {
      name: r.name,
      status: r.status,
      location: r.loc,
      customerId,
      startDate: r.start ? new Date(r.start) : null,
      endDate: r.end ? new Date(r.end) : null,
      note: r.note,
    };
    const existing = await db.project.findUnique({ where: { code: r.code } });
    if (existing) {
      await db.project.update({ where: { code: r.code }, data });
      updated++;
    } else {
      await db.project.create({ data: { code: r.code, ...data } });
      created++;
    }
    console.log(`${r.code}  ${r.name.padEnd(14)} ${r.cdt ?? "—"}`);
  }
  console.log(`\nXong: tạo mới ${created}, cập nhật ${updated}, thêm CĐT mới ${customers}.`);
}

main().finally(() => db.$disconnect());
