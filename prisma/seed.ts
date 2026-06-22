import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const USERS = [
  { email: "admin@cty.com", name: "Quản trị viên", role: "ADMIN" },
  { email: "sales@cty.com", name: "Phòng Kinh doanh", role: "SALES" },
  { email: "kythuat@cty.com", name: "Phòng Kỹ thuật", role: "ENGINEERING" },
  { email: "vattu@cty.com", name: "Phòng Vật tư", role: "PROCUREMENT" },
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash("123456", 10);
  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { ...u, passwordHash },
    });
  }
}

async function clearDomain() {
  await db.estimateItem.deleteMany();
  await db.weeklyLog.deleteMany();
  await db.milestone.deleteMany();
  await db.projectSupplier.deleteMany();
  await db.project.deleteMany();
  await db.supplier.deleteMany();
  await db.customer.deleteMany();
}

async function main() {
  await seedUsers();
  await clearDomain();

  // ----- Khách hàng / CĐT -----
  const customers = await Promise.all(
    [
      { name: "Cty Hà Minh", contactPerson: "Mr. Minh", phone: "0980000001" },
      { name: "Cty Sơn Việt", contactPerson: "Mr. Việt", phone: "0980000002" },
      { name: "Trần Bích Phượng", phone: "0980000003" },
      { name: "Cty Kama", contactPerson: "Mr. Ka", phone: "0980000004" },
      { name: "Nguyễn Đình Duyên", phone: "0980000005" },
    ].map((c) => db.customer.create({ data: c }))
  );
  const cust = Object.fromEntries(customers.map((c) => [c.name, c.id]));

  // ----- Nhà cung cấp -----
  const supplierDefs = [
    { name: "KCT Hưng Yên", category: "KCT" },
    { name: "DMF", category: "KCT" },
    { name: "TH Steel", category: "KCT" },
    { name: "Tấn Dũng", category: "KCT" },
    { name: "Phú Thành", category: "XA_GO" },
    { name: "Đức Mạnh", category: "XA_GO" },
    { name: "Hòa Phát", category: "TON" },
    { name: "Khải Phát", category: "TON" },
    { name: "Phú Thăng", category: "BL_NEO" },
    { name: "KAT", category: "BLLK" },
    { name: "CPR", category: "BLLK" },
    { name: "Đội Mr. Toản", category: "LAP_DUNG" },
    { name: "Đội Mr. Lân", category: "LAP_DUNG" },
  ];
  const suppliers = await Promise.all(
    supplierDefs.map((s) => db.supplier.create({ data: s }))
  );
  const sup = Object.fromEntries(suppliers.map((s) => [s.name, s.id]));

  // ----- Dự án -----
  const projectDefs = [
    {
      code: "N037",
      name: "K25L60_PT",
      buildingType: "Xưởng",
      status: "HOAN_THANH",
      location: "Phú Thọ",
      customerId: cust["Cty Hà Minh"],
      startDate: new Date("2026-01-29"),
      kK: 25,
      kL: 60,
      kH: 8,
      area: 1500,
      salePrice: 1_100_000_000,
    },
    {
      code: "N044",
      name: "K20L20_TQ",
      buildingType: "Xưởng",
      status: "HOAN_THANH",
      location: "Tuyên Quang",
      customerId: cust["Trần Bích Phượng"],
      startDate: new Date("2026-03-26"),
      kK: 20,
      kL: 20,
      kH: 6,
      area: 400,
      salePrice: 280_000_000,
    },
    {
      code: "N048",
      name: "K35L63_TH",
      buildingType: "Xưởng",
      status: "HOAN_THANH",
      location: "Trường Lâm, Thanh Hóa",
      customerId: cust["Cty Kama"],
      startDate: new Date("2026-04-09"),
      kK: 35,
      kL: 63,
      kH: 9,
      area: 2205,
      salePrice: 1_600_000_000,
    },
    {
      code: "N051",
      name: "K25L47_PT",
      buildingType: "Xưởng",
      status: "LAP_DUNG",
      location: "Thanh Sơn, Phú Thọ",
      customerId: cust["Cty Sơn Việt"],
      startDate: new Date("2026-04-21"),
      kK: 25,
      kL: 47,
      kH: 8,
      area: 1175,
    },
    {
      code: "N055",
      name: "K20L30_HT",
      buildingType: "Xưởng",
      status: "GIA_CONG",
      location: "Hà Tĩnh",
      customerId: cust["Nguyễn Đình Duyên"],
      startDate: new Date("2026-03-25"),
      kK: 20,
      kL: 30,
      kH: 7,
      area: 600,
    },
    {
      code: "N056",
      name: "K20L68_HT",
      buildingType: "Xưởng",
      status: "GIA_CONG",
      location: "Thanh Hóa",
      startDate: new Date("2026-03-12"),
      kK: 20,
      kL: 68,
      kH: 7,
      area: 1360,
    },
  ];
  const projects = await Promise.all(
    projectDefs.map((p) => db.project.create({ data: p }))
  );
  const proj = Object.fromEntries(projects.map((p) => [p.code, p.id]));

  // ----- NCC theo hạng mục (N037) -----
  await db.projectSupplier.createMany({
    data: [
      { projectId: proj["N037"], supplierId: sup["Tấn Dũng"], component: "KCT" },
      { projectId: proj["N037"], supplierId: sup["Phú Thăng"], component: "BL_NEO" },
      { projectId: proj["N037"], supplierId: sup["Đội Mr. Toản"], component: "LAP_DUNG" },
      { projectId: proj["N051"], supplierId: sup["KCT Hưng Yên"], component: "KCT" },
      { projectId: proj["N051"], supplierId: sup["Phú Thành"], component: "XA_GO" },
    ],
  });

  // ----- Mốc tiến độ (N037) -----
  await db.milestone.createMany({
    data: [
      { projectId: proj["N037"], type: "BV_KT", done: true },
      { projectId: proj["N037"], type: "SHOP", done: true },
      { projectId: proj["N037"], type: "MUA_HANG", done: true },
      { projectId: proj["N037"], type: "GIA_CONG", planDate: new Date("2026-02-28"), done: true },
      { projectId: proj["N037"], type: "LAP_DUNG", planDate: new Date("2026-03-30"), done: true },
    ],
  });

  // ----- Dự toán (N037) — lấy từ sheet -----
  await db.estimateItem.createMany({
    data: [
      { projectId: proj["N037"], groupCode: "KCT", name: "Thép tổ hợp", unit: "kg", designQty: 17870.16, unitPrice: 20500, amount: 366338280, supplierId: sup["Tấn Dũng"], sortOrder: 1 },
      { projectId: proj["N037"], groupCode: "KCT", name: "Thép hình", unit: "kg", designQty: 2570.39, unitPrice: 24200, amount: 62203438, supplierId: sup["Tấn Dũng"], sortOrder: 2 },
      { projectId: proj["N037"], groupCode: "XA_GO", name: "Xà gồ mái", unit: "kg", designQty: 7635.08, unitPrice: 18500, amount: 141248980, supplierId: sup["Phú Thành"], sortOrder: 3 },
      { projectId: proj["N037"], groupCode: "NHAN_CONG", name: "TC KCT", unit: "kg", designQty: 28075.63, unitPrice: 1800, amount: 50536134, supplierId: sup["Đội Mr. Toản"], sortOrder: 4 },
    ],
  });

  // ----- Dự toán (N044 = K20L20) — Khung mái -----
  await db.estimateItem.createMany({
    data: [
      { projectId: proj["N044"], groupCode: "KCT", name: "Thép tổ hợp", unit: "kg", designQty: 5660.6, unitPrice: 20580, amount: 116495148, sortOrder: 1 },
      { projectId: proj["N044"], groupCode: "KCT", name: "Thép hình", unit: "kg", designQty: 709.39, unitPrice: 23310, amount: 16535880, sortOrder: 2 },
      { projectId: proj["N044"], groupCode: "XA_GO", name: "Xà gồ", unit: "kg", designQty: 1571.84, unitPrice: 16636, amount: 26149701, sortOrder: 3 },
      { projectId: proj["N044"], groupCode: "BL_NEO", name: "Bộ bulong neo", unit: "bộ", designQty: 40, unitPrice: 80000, amount: 3200000, sortOrder: 4 },
    ],
  });

  // ----- Nhật ký tuần (mẫu) -----
  await db.weeklyLog.createMany({
    data: [
      { projectId: proj["N055"], year: 2026, week: 25, statusSnapshot: "GIA_CONG", note: "KCT gia công, hẹn 2 tuần lấy hàng" },
      { projectId: proj["N056"], year: 2026, week: 25, statusSnapshot: "GIA_CONG", note: "KCT gia công, hẹn 3 tuần lấy; thứ 3 có shop" },
      { projectId: proj["N051"], year: 2026, week: 25, statusSnapshot: "LAP_DUNG", note: "Hoàn thiện khung, chờ tôn" },
    ],
  });

  const counts = {
    users: await db.user.count(),
    customers: await db.customer.count(),
    suppliers: await db.supplier.count(),
    projects: await db.project.count(),
    estimates: await db.estimateItem.count(),
  };
  console.log("Seed xong:", counts, "(mật khẩu user: 123456)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
