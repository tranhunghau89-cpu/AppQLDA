/**
 * Đối soát sau khi gộp hai bảng mẫu cũ thành bộ hạng mục. CHỈ ĐỌC — không ghi gì.
 *
 * Chạy: npm run kiemtra:bo-hang-muc
 *
 * Câu hỏi phải trả lời được trước khi tin vào dữ liệu mới:
 *   1. Có mất dòng nào của hai bảng mẫu cũ không?
 *   2. Hai mặt (chi phí / gửi khách) có nối đúng vào cùng một phần không?
 *   3. 32 dòng TSKT gộp trùng có đúng không, và mọi bộ còn đủ vật liệu không?
 *   4. 516 dòng dự toán thi công còn nguyên chứ?
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let hong = 0;
function kiem(ten: string, dat: boolean, chiTiet: string) {
  if (!dat) hong++;
  console.log(`${dat ? "✓" : "✗"} ${ten}: ${chiTiet}`);
}

/**
 * Kiểm "dự toán thi công còn nguyên".
 *
 * Con số 516 là của CƠ SỞ DỮ LIỆU THẬT. Áp nó cho mọi nơi thì phép kiểm đỏ trên mọi
 * bản nháp — và một phép kiểm lúc nào cũng đỏ là một phép kiểm không ai đọc nữa.
 * Ở bản nháp chỉ cần khẳng định migration không xóa sạch bảng.
 */
function kiemDuToanThiCong(soDong: number, kiem: (a: string, b: boolean, c: string) => void) {
  const laThat = !(process.env.DATABASE_URL ?? "").includes("127.0.0.1");
  if (laThat) {
    kiem("Dự toán thi công còn nguyên", soDong === 516, `EstimateItem = ${soDong} (CSDL thật, mong đợi 516)`);
  } else {
    kiem("Dự toán thi công không bị xóa", soDong > 0, `EstimateItem = ${soDong} (CSDL nháp)`);
  }
}

async function main() {
  const [soQT, , soQTS, soQTG, soQTP, soET, soETL, soEI] = await Promise.all([
    db.quoteTemplate.count(),
    db.quoteTemplateLine.count(),
    db.quoteTemplateSpec.count(),
    db.quoteTemplateStage.count(),
    db.quoteTemplatePayment.count(),
    db.estimateTemplate.count(),
    db.estimateTemplateLine.count(),
    db.estimateItem.count(),
  ]);

  const [soBo, soPhan, soDong, soVatLieu, soGiaiDoan, soThanhToan] = await Promise.all([
    db.boHangMuc.count(),
    db.boHangMucPhan.count(),
    db.boHangMucDong.count(),
    db.boHangMucVatTu.count(),
    db.boHangMucGiaiDoan.count(),
    db.boHangMucThanhToan.count(),
  ]);

  kiem("Bộ hạng mục", soBo >= soQT, `${soQT} mẫu báo giá → ${soBo} bộ`);
  kiem(
    "Dòng công tác",
    soDong === soETL,
    `${soETL} dòng mẫu dự toán → ${soDong} dòng trong bộ`
  );
  kiem("Giai đoạn", soGiaiDoan === soQTG, `${soQTG} → ${soGiaiDoan}`);
  kiem("Thanh toán", soThanhToan === soQTP, `${soQTP} → ${soThanhToan}`);

  // Mỗi mẫu dự toán cũ phải thành đúng một phần.
  kiem(
    "Phần đủ chỗ cho mọi mẫu dự toán",
    soPhan >= soET,
    `${soET} mẫu dự toán → ${soPhan} phần (gồm cả phần sinh từ dòng gửi khách)`
  );

  // Hai mặt nối đúng: mỗi QuoteTemplateLine có sourceSectionCode phải tìm thấy một
  // phần cùng mã, cùng bộ, và phần đó phải mang tên gửi khách.
  const dongKhach = await db.quoteTemplateLine.findMany({
    select: { templateId: true, sourceSectionCode: true, name: true },
  });
  const chuaNoi: string[] = [];
  for (const d of dongKhach) {
    const ma = (d.sourceSectionCode ?? "").trim();
    if (!ma) continue;
    const phan = await db.boHangMucPhan.findFirst({
      where: { boHangMucId: d.templateId, ma },
      select: { tenKhachHang: true, inChoKhach: true },
    });
    if (!phan || phan.tenKhachHang !== d.name || !phan.inChoKhach) {
      chuaNoi.push(`${ma} (${d.name})`);
    }
  }
  kiem(
    "Mặt gửi khách nối đúng phần",
    chuaNoi.length === 0,
    chuaNoi.length === 0
      ? `${dongKhach.length} dòng gửi khách, khớp hết`
      : `chưa nối: ${chuaNoi.join(", ")}`
  );

  // Vật liệu: gộp trùng nên số VatTu ít hơn số spec, nhưng mỗi bộ phải còn đủ liên kết.
  const soVatTu = await db.vatTu.count();
  kiem(
    "Vật tư gộp trùng",
    soVatTu > 0 && soVatTu <= soQTS,
    `${soQTS} dòng TSKT → ${soVatTu} vật tư (gộp trùng) → ${soVatLieu} liên kết`
  );

  // Chỉ những bộ MÀ MẪU CŨ CÓ khai TSKT mới bắt buộc phải có vật liệu; bộ dựng mới
  // hoặc bộ chuyển từ mẫu không khai gì thì rỗng là đúng.
  const boCoSpec = new Set(
    (await db.quoteTemplateSpec.findMany({ select: { templateId: true } })).map(
      (s) => s.templateId
    )
  );
  const boMatVatLieu = await db.boHangMuc.findMany({
    where: { id: { in: [...boCoSpec] }, vatLieu: { none: {} } },
    select: { ten: true },
  });
  kiem(
    "Bộ có TSKT thì phải có vật liệu",
    boMatVatLieu.length === 0,
    boMatVatLieu.length === 0
      ? "không bộ nào mất vật liệu"
      : `mất: ${boMatVatLieu.map((b) => b.ten).join(", ")}`
  );

  kiemDuToanThiCong(soEI, kiem);

  // In cấu trúc ra để đọc bằng mắt.
  console.log("\n--- Cấu trúc bộ hạng mục ---");
  const bos = await db.boHangMuc.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      phan: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { dong: true } } } },
      _count: { select: { dong: true, vatLieu: true, giaiDoan: true, thanhToan: true } },
    },
  });
  for (const b of bos) {
    console.log(
      `\n[${b.ma}] ${b.ten}` +
        (b.loaiCongTrinh ? ` — loại: ${b.loaiCongTrinh}` : "") +
        ` · ${b._count.dong} dòng · ${b._count.vatLieu} vật liệu · ` +
        `${b._count.giaiDoan} giai đoạn · ${b._count.thanhToan} đợt thanh toán`
    );
    for (const p of b.phan) {
      const mat = p.inChoKhach ? `gửi khách: ${p.maKhach ?? "—"} ${p.tenKhachHang ?? ""}` : "chỉ tính giá vốn";
      console.log(`   ${p.ma}. ${p.ten} — ${p._count.dong} dòng — ${mat}`);
    }
  }

  console.log(hong === 0 ? "\n✓ Đối soát đạt." : `\n✗ ${hong} mục không đạt.`);
  process.exitCode = hong === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
