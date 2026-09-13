/**
 * Gắn tham số dẫn xuất cho các dòng dự toán chào giá đã áp bộ hạng mục trước khi áp bộ
 * biết chép tham số, rồi tính lại khối lượng các dòng dẫn xuất.
 *
 * Chạy xem trước:  DATABASE_URL=... npx tsx scripts/gan-tham-so-dan-xuat-bao-gia.ts
 * Chạy ghi thật:   DATABASE_URL=... npx tsx scripts/gan-tham-so-dan-xuat-bao-gia.ts --ghi
 *
 * Sau khi chạy, "Vận chuyển KCT" / "Lắp dựng KCT" bằng tổng kg thép của hạng mục,
 * "Vận chuyển tôn" / "Lợp tôn" bằng tổng m² tôn — và tự chạy theo mỗi lần sửa thép.
 *
 * ĐỌC KỸ phần "sẽ ĐÈ" của bản xem trước: dòng dẫn xuất đang có khối lượng gõ tay khác
 * con số tính ra sẽ bị thay. Đó chính là mục đích, nhưng người lập phải biết.
 *
 * Chỉ xét dòng chưa có tham số nào, nên chạy lại lần hai không làm gì. Không đụng đơn
 * giá, tên, nhóm. Luật so khớp ở `src/lib/thuVien/ganThamSoDanXuat.ts` (có test).
 */
import { PrismaClient } from "@prisma/client";
import { ganThamSoDanXuat } from "../src/lib/thuVien/ganThamSoDanXuat";
import { tinhKhoiLuongDanXuat } from "../src/lib/thuVien/danXuat";

const db = new PrismaClient();
const GHI = process.argv.includes("--ghi");

async function main() {
  console.log("DATABASE_URL:", (process.env.DATABASE_URL ?? "").slice(0, 40));
  console.log(GHI ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: chỉ xem trước (thêm --ghi để ghi)\n");

  const [items, boDong] = await Promise.all([
    db.quoteItem.findMany({
      where: { napThamSo: null, layTuThamSo: null },
      select: {
        id: true,
        quoteId: true,
        name: true,
        tenGon: true,
        unit: true,
        section: { select: { code: true } },
      },
    }),
    db.boHangMucDong.findMany({
      where: { OR: [{ napThamSo: { not: null } }, { layTuThamSo: { not: null } }] },
      select: {
        ten: true,
        donVi: true,
        napThamSo: true,
        layTuThamSo: true,
        heSoQuyDoi: true,
        phan: { select: { ma: true } },
      },
    }),
  ]);

  const kq = ganThamSoDanXuat(
    items.map((i) => ({
      id: i.id,
      maMuc: i.section.code,
      ten: i.tenGon?.trim() || i.name,
      unit: i.unit,
    })),
    boDong
      .filter((b) => b.phan)
      .map((b) => ({
        maPhan: b.phan!.ma,
        ten: b.ten,
        donVi: b.donVi,
        napThamSo: b.napThamSo,
        layTuThamSo: b.layTuThamSo,
        heSoQuyDoi: b.heSoQuyDoi,
      }))
  );
  const thamSoCua = new Map(kq.gan.map((g) => [g.id, g]));
  const quoteIds = [...new Set(items.filter((i) => thamSoCua.has(i.id)).map((i) => i.quoteId))];

  // Tính lại khối lượng dẫn xuất TRONG BỘ NHỚ với tham số mới, để bản xem trước nói
  // đúng con số sẽ ghi — kể cả dòng nào sẽ bị đè.
  const [dongBan, phanBan, quotes] = await Promise.all([
    db.quoteItem.findMany({
      where: { quoteId: { in: quoteIds } },
      select: {
        id: true,
        quoteId: true,
        sectionId: true,
        name: true,
        tenGon: true,
        qty: true,
        napThamSo: true,
        layTuThamSo: true,
        heSoQuyDoi: true,
      },
    }),
    db.quoteSection.findMany({
      where: { quoteId: { in: quoteIds } },
      select: { id: true, quoteId: true, parentId: true },
    }),
    db.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, title: true } }),
  ]);
  const tenBan = new Map(quotes.map((q) => [q.id, q.title]));

  const qtyMoi = new Map<string, number | null>();
  let soDe = 0;
  for (const qid of quoteIds) {
    const dong = dongBan
      .filter((d) => d.quoteId === qid)
      .map((d) => ({ ...d, ...(thamSoCua.get(d.id) ?? {}) }));
    const tinh = tinhKhoiLuongDanXuat(dong, phanBan.filter((p) => p.quoteId === qid));
    console.log(`--- ${tenBan.get(qid)} ---`);
    for (const d of dong) {
      const t = tinh.get(d.id);
      if (!t || t.khoiLuong === d.qty) continue;
      qtyMoi.set(d.id, t.khoiLuong);
      const de = d.qty != null;
      if (de) soDe += 1;
      console.log(
        `  ${(d.tenGon ?? d.name).padEnd(26)} lấy ${d.layTuThamSo}: ` +
          `${d.qty ?? "—"} → ${t.khoiLuong ?? "—"}${de ? "   ⚠ sẽ ĐÈ số đang có" : ""}`
      );
    }
  }

  if (kq.mapMo.length) {
    console.log("\n--- Mập mờ, KHÔNG gắn ---");
    for (const m of kq.mapMo) console.log(`  ${m.ten} — ${m.soPhuongAn} phương án`);
  }
  console.log(
    `\nGắn tham số ${kq.gan.length} dòng trong ${quoteIds.length} bản · ` +
      `khối lượng dẫn xuất đổi ${qtyMoi.size} dòng (đè số đang có: ${soDe}) · mập mờ ${kq.mapMo.length}`
  );

  if (!GHI) {
    console.log("\nChưa ghi gì. Thêm --ghi để áp vào cơ sở dữ liệu.");
    return;
  }

  // Gom theo GIÁ TRỊ: vài tổ hợp tham số và vài con số khối lượng phục vụ hàng trăm dòng.
  const t0 = Date.now();
  const nhomThamSo = new Map<string, { data: Omit<(typeof kq.gan)[number], "id">; ids: string[] }>();
  for (const g of kq.gan) {
    const { id, ...data } = g;
    const k = JSON.stringify(data);
    const e = nhomThamSo.get(k);
    if (e) e.ids.push(id);
    else nhomThamSo.set(k, { data, ids: [id] });
  }
  const nhomQty = new Map<number | null, string[]>();
  for (const [id, qty] of qtyMoi) {
    const e = nhomQty.get(qty);
    if (e) e.push(id);
    else nhomQty.set(qty, [id]);
  }
  await db.$transaction([
    ...[...nhomThamSo.values()].map(({ data, ids }) =>
      db.quoteItem.updateMany({ where: { id: { in: ids } }, data })
    ),
    ...[...nhomQty].map(([qty, ids]) =>
      db.quoteItem.updateMany({ where: { id: { in: ids } }, data: { qty } })
    ),
  ]);
  console.log(
    `\n✓ Đã ghi bằng ${nhomThamSo.size + nhomQty.size} lệnh, ${((Date.now() - t0) / 1000).toFixed(2)} s.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
