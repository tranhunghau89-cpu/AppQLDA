/**
 * Gán tên gọn + nhóm cho các dòng dự toán chào giá đã áp bộ hạng mục trước khi có hai
 * cột `QuoteItem.tenGon` / `QuoteItem.groupLabel`.
 *
 * Chạy xem trước:  DATABASE_URL=... npx tsx scripts/gan-ten-gon-nhom-bao-gia.ts
 * Chạy ghi thật:   DATABASE_URL=... npx tsx scripts/gan-ten-gon-nhom-bao-gia.ts --ghi
 *
 * Mỗi dòng khớp được với bộ hạng mục (cùng mã mục, tên, đơn vị) sẽ:
 *   - lấy tên đang có làm TÊN GỌN ("Vật tư"),
 *   - nhận NHÓM của dòng bộ ("Bulong neo"),
 *   - đổi tên thành TÊN ĐẦY ĐỦ của công tác nếu dòng bộ đã gắn mã,
 *   - nhận ghi chú của bộ nếu dòng chưa có ghi chú.
 * Không đụng khối lượng, đơn giá, hay dòng gõ tay. Chỉ xét dòng chưa có cả tên gọn lẫn
 * nhóm, nên chạy lại lần hai không làm gì.
 *
 * Luật so khớp nằm ở `src/lib/thuVien/ganTenGonNhom.ts` (có test).
 */
import { PrismaClient } from "@prisma/client";
import { ganTenGonNhom } from "../src/lib/thuVien/ganTenGonNhom";

const db = new PrismaClient();
const GHI = process.argv.includes("--ghi");

async function main() {
  console.log("DATABASE_URL:", (process.env.DATABASE_URL ?? "").slice(0, 40));
  console.log(GHI ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: chỉ xem trước (thêm --ghi để ghi)\n");

  const [items, boDong] = await Promise.all([
    db.quoteItem.findMany({
      where: { tenGon: null, groupLabel: null },
      select: {
        id: true,
        name: true,
        unit: true,
        note: true,
        section: { select: { code: true } },
        quote: { select: { title: true } },
      },
    }),
    db.boHangMucDong.findMany({
      select: {
        ten: true,
        donVi: true,
        groupLabel: true,
        ghiChu: true,
        phan: { select: { ma: true } },
        congTac: { select: { ten: true } },
      },
    }),
  ]);

  const kq = ganTenGonNhom(
    items.map((i) => ({ id: i.id, maMuc: i.section.code, name: i.name, unit: i.unit, note: i.note })),
    boDong
      .filter((b) => b.phan)
      .map((b) => ({
        maPhan: b.phan!.ma,
        ten: b.ten,
        donVi: b.donVi,
        groupLabel: b.groupLabel,
        ghiChu: b.ghiChu,
        tenCongTac: b.congTac?.ten ?? null,
      }))
  );

  const theoId = new Map(items.map((i) => [i.id, i]));
  console.log("--- Sẽ gán ---");
  for (const g of kq.gan) {
    const i = theoId.get(g.id)!;
    console.log(
      `  ${i.quote.title.slice(0, 28).padEnd(28)} | ${i.section.code.padEnd(3)} | ` +
        `${(g.groupLabel ?? "—").padEnd(18)} | ${g.tenGon.padEnd(20)}` +
        (g.name ? ` → ${g.name}` : "") +
        (g.note ? ` · ghi chú "${g.note}"` : "")
    );
  }
  if (kq.mapMo.length) {
    console.log("\n--- Mập mờ, KHÔNG gán (sửa tay trong hộp thoại sửa dòng) ---");
    for (const m of kq.mapMo) console.log(`  ${m.name} — ${m.soPhuongAn} phương án`);
  }
  console.log(
    `\nXét ${items.length} dòng · gán ${kq.gan.length} · mập mờ ${kq.mapMo.length} · ` +
      `không khớp bộ nào ${kq.soKhongKhop}`
  );

  if (!GHI) {
    console.log("\nChưa ghi gì. Thêm --ghi để áp vào cơ sở dữ liệu.");
    return;
  }

  // Mỗi dòng một giá trị riêng nên không gom `updateMany` được. Chạy từng lô 10 lệnh
  // song song — không bọc giao dịch tương tác (hạn 5 giây), và mỗi lệnh tự đủ nghĩa:
  // đứt giữa chừng thì chạy lại, vì dòng đã gán không còn thoả điều kiện lọc.
  const t0 = Date.now();
  for (let i = 0; i < kq.gan.length; i += 10) {
    await Promise.all(
      kq.gan.slice(i, i + 10).map((g) =>
        db.quoteItem.update({
          where: { id: g.id },
          data: {
            tenGon: g.tenGon,
            groupLabel: g.groupLabel,
            ...(g.name ? { name: g.name } : {}),
            ...(g.note ? { note: g.note } : {}),
          },
        })
      )
    );
  }
  console.log(`\n✓ Đã ghi ${kq.gan.length} dòng, ${((Date.now() - t0) / 1000).toFixed(2)} s.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
