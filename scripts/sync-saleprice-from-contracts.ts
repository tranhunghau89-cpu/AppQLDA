// Đồng bộ một lần giá bán dự án theo hợp đồng (quy tắc ở salePriceFromContracts).
// Mặc định chỉ IN danh sách thay đổi. Thêm --apply để ghi thật (kèm nhật ký).
// Chạy: npx tsx scripts/sync-saleprice-from-contracts.ts [--apply]
import { PrismaClient } from "@prisma/client";
import { computeContractTotals, salePriceFromContracts } from "../src/lib/contract";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const fmt = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("vi-VN"));

async function main() {
  const projects = await db.project.findMany({
    where: { contracts: { some: {} } },
    select: {
      id: true,
      code: true,
      name: true,
      salePrice: true,
      contracts: {
        select: { id: true, status: true, vatPercent: true, valueBeforeVat: true, items: true },
      },
    },
    orderBy: { code: "asc" },
  });

  let doi = 0;
  for (const p of projects) {
    // Tính lại từ hạng mục, phòng giá trị lưu sẵn trên HĐ đã cũ.
    const hd = p.contracts.map((c) => {
      const t = computeContractTotals(c.items, c.vatPercent);
      return { ...c, beforeVat: t.beforeVat, withVat: t.withVat };
    });
    const { salePrice, locked } = salePriceFromContracts(
      hd.map((c) => ({ status: c.status, valueBeforeVat: c.beforeVat }))
    );
    if (salePrice == null || salePrice === p.salePrice) continue;
    doi++;
    console.log(
      `${p.code.padEnd(6)} ${p.name.slice(0, 28).padEnd(28)} ${fmt(p.salePrice).padStart(16)} → ${fmt(salePrice).padStart(16)}  ${locked ? "HĐ ký" : "HĐ nháp"} (${hd.length} HĐ)`
    );
    if (!APPLY) continue;
    await db.$transaction([
      ...hd
        .filter((c) => c.valueBeforeVat !== c.beforeVat)
        .map((c) =>
          db.contract.update({
            where: { id: c.id },
            data: { valueBeforeVat: c.beforeVat, valueWithVat: c.withVat },
          })
        ),
      db.project.update({ where: { id: p.id }, data: { salePrice } }),
      db.auditLog.create({
        data: {
          actorId: "system",
          actorName: "Đồng bộ giá bán theo HĐ",
          actorRole: "SYSTEM",
          entity: "Project",
          entityId: p.id,
          entityLabel: p.code,
          projectId: p.id,
          action: "UPDATE",
          changes: { salePrice: { truoc: p.salePrice, sau: salePrice } },
        },
      }),
    ]);
  }
  console.log(
    `\n${projects.length} dự án có HĐ, ${doi} dự án lệch giá bán. ${APPLY ? "ĐÃ GHI." : "Chạy thử — chưa ghi gì (thêm --apply)."}`
  );
}

main().finally(() => db.$disconnect());
