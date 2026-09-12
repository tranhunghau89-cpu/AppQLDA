import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  console.log("DATABASE_URL:", (process.env.DATABASE_URL ?? "").slice(0, 40));
  const bo = await db.boHangMuc.findFirst({ where: { ma: "BHM-710BC1" }, select: { id: true } });
  const d = await db.boHangMucDong.findMany({
    where: { boHangMucId: bo!.id },
    select: { ten: true, donVi: true, vaiTro: true, napThamSo: true, layTuThamSo: true, heSoQuyDoi: true, suatKhoiLuong: true, sortOrder: true, phan: { select: { ma: true, sortOrder: true } } },
  });
  d.sort((a, b) => (a.phan?.sortOrder ?? 0) - (b.phan?.sortOrder ?? 0) || a.sortOrder - b.sortOrder);
  for (const x of d) {
    console.log(
      `[${x.phan?.ma}] ${x.ten.padEnd(26)} ${(x.donVi ?? "").padEnd(7)} ${x.vaiTro.padEnd(8)} nạp=${(x.napThamSo ?? "-").padEnd(10)} lấy=${(x.layTuThamSo ?? "-").padEnd(10)} hs=${x.heSoQuyDoi ?? "-"}  suất=${x.suatKhoiLuong ?? "-"}`
    );
  }
  const n = d.filter((x) => x.vaiTro === "DERIVED").length;
  console.log(`\nDERIVED ${n}/${d.length} · có napThamSo ${d.filter((x) => x.napThamSo).length} · có layTuThamSo ${d.filter((x) => x.layTuThamSo).length}`);
}
main().finally(() => db.$disconnect());
