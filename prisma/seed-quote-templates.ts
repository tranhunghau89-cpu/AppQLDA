// Seed thư viện mẫu báo giá gửi khách.
//
// Một mẫu dùng chung dựng từ clientQuoteDefaults (16 dòng vật liệu, 5 chặng thi công,
// 4 đợt thanh toán) + một mẫu "Nhà xưởng" có sẵn 2 hạng mục khớp báo giá mẫu K50L120.
//
// Idempotent: xóa mẫu trùng TÊN rồi tạo lại — chạy lại bao nhiêu lần cũng ra đúng một
// bản. Cố ý KHÔNG upsert theo id: mẫu người dùng tự soạn không được đụng tới.
// Chạy: npm run db:seed:quote-templates
import { PrismaClient } from "@prisma/client";
import { mauMacDinh } from "../src/lib/quoteTemplate";

const db = new PrismaClient();

interface LineSeed {
  code: string;
  name: string;
  tags: string[];
  /** Mã "phần" bên báo giá chi tiết để suy đơn giá m². */
  sourceSectionCode: string | null;
}

interface TemplateSeed {
  name: string;
  buildingType: string | null;
  description: string;
  lines: LineSeed[];
}

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Mẫu chung — kết cấu thép và bao che",
    buildingType: null,
    description:
      "Mẫu dùng chung cho mọi loại công trình khi chưa có mẫu riêng. Không khai sẵn hạng mục: hạng mục lấy thẳng từ các phần của báo giá chi tiết.",
    lines: [],
  },
  {
    name: "Nhà xưởng kết cấu thép + bao che",
    buildingType: "Nhà xưởng",
    description:
      "Theo báo giá mẫu K50L120 (Hồng Ngự, Đồng Tháp): khung thép và tôn phần mái, phần thưng.",
    lines: [
      {
        code: "01",
        name: "Khung thép và tôn phần mái",
        tags: ["KHUNG_THEP", "TON_MAI"],
        sourceSectionCode: "A",
      },
      {
        code: "02",
        name: "Phần thưng",
        tags: ["TON_THUNG"],
        sourceSectionCode: "B",
      },
    ],
  },
];

async function main() {
  const k = mauMacDinh();

  for (const [i, t] of TEMPLATES.entries()) {
    await db.quoteTemplate.deleteMany({ where: { name: t.name } });

    await db.quoteTemplate.create({
      data: {
        name: t.name,
        buildingType: t.buildingType,
        description: t.description,
        active: true,
        sortOrder: i,
        vatPercent: k.vatPercent,
        validDays: k.validDays,
        warrantyMonths: k.warrantyMonths,
        maintenanceMonths: k.maintenanceMonths,
        loadRoof: k.loadRoof,
        loadHanging: k.loadHanging,
        loadFloor: k.loadFloor,
        lineDetail: k.lineDetail,
        greeting: k.greeting,
        closing: k.closing,
        colorNote: k.colorNote,
        volumeNote: k.volumeNote,
        excludeNote: k.excludeNote,
        lines: {
          create: t.lines.map((l, j) => ({
            partCode: "I",
            partName: "Phần kết cấu thép",
            code: l.code,
            name: l.name,
            unit: "m2",
            tags: l.tags,
            sourceSectionCode: l.sourceSectionCode,
            sortOrder: j,
          })),
        },
        specs: { create: k.specs.map((s, j) => ({ ...s, sortOrder: j })) },
        stages: { create: k.stages.map((s, j) => ({ ...s, sortOrder: j })) },
        payments: { create: k.payments.map((p, j) => ({ ...p, sortOrder: j })) },
      },
    });

    console.log(
      `Seeded mẫu báo giá "${t.name}" — ${t.lines.length} hạng mục, ${k.specs.length} vật liệu`
    );
  }
}

main()
  .then(() => console.log("Done."))
  .finally(() => db.$disconnect());
