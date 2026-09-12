/**
 * CHỈ ĐỌC. Đo chi phí một lượt đi-về tới CSDL thật và tìm báo giá to nhất, để quy ra
 * thời gian của bản chép cũ (một lệnh mỗi hàng) và bản mới (hai lệnh).
 */
import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: path.resolve(process.cwd(), ".env"), override: true });
const url = process.env.DATABASE_URL ?? "";
console.log(`DATABASE_URL[0..40] = ${url.slice(0, 40)}`);
if (!url) throw new Error("Chưa có DATABASE_URL");

const db = new PrismaClient({ datasourceUrl: url });

async function main() {
  await db.$queryRaw`SELECT 1`; // làm nóng: lần đầu gồm cả bắt tay TLS

  const N = 12;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) await db.$queryRaw`SELECT 1`;
  const doiVe = (Date.now() - t0) / N;
  console.log(`Một lượt đi-về: ${doiVe.toFixed(0)} ms (trung bình ${N} lệnh)`);

  const phan = await db.quoteSection.groupBy({ by: ["quoteId"], _count: { _all: true } });
  const dong = await db.quoteItem.groupBy({ by: ["quoteId"], _count: { _all: true } });
  const soDong = new Map(dong.map((d) => [d.quoteId, d._count._all]));

  const bang = phan
    .map((p) => ({
      quoteId: p.quoteId,
      phan: p._count._all,
      dong: soDong.get(p.quoteId) ?? 0,
    }))
    .sort((a, b) => b.phan + b.dong - (a.phan + a.dong));

  console.log(`\n${bang.length} báo giá có phần. 5 bản to nhất:`);
  for (const b of bang.slice(0, 5)) {
    const cu = 1 + b.phan + b.dong;
    console.log(
      `  ${b.quoteId}  ${b.phan} phần + ${b.dong} dòng` +
        `  → CŨ ${cu} lệnh ≈ ${((cu * doiVe) / 1000).toFixed(1)} s` +
        `  · MỚI 3 lệnh ≈ ${((3 * doiVe) / 1000).toFixed(2)} s`
    );
  }

  const to = bang[0];
  console.log(
    `\nHạn giao dịch tương tác Prisma: 5 s.` +
      `\n  Bản CŨ trên bản to nhất: ${((1 + to.phan + to.dong) * doiVe / 1000).toFixed(1)} s → ${
        (1 + to.phan + to.dong) * doiVe > 5000 ? "QUÁ HẠN" : "còn trong hạn"
      }` +
      `\n  Ngưỡng vỡ của bản CŨ: ${Math.ceil(5000 / doiVe)} hàng` +
      ` → báo giá từ ~${Math.ceil(5000 / doiVe) - 1} phần+dòng trở lên là hỏng.`
  );

  // Mã phần/mục có trùng nhau trong cùng một báo giá không? (vì sao không tra bằng mã)
  const trung = await db.$queryRaw<{ quoteId: string; code: string; n: bigint }[]>`
    SELECT "quoteId", code, COUNT(*) AS n
    FROM "QuoteSection" GROUP BY "quoteId", code HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC LIMIT 5`;
  console.log(
    `\nMã phần/mục trùng trong cùng báo giá: ${trung.length === 0 ? "không thấy" : ""}`
  );
  for (const t of trung) console.log(`  ${t.quoteId} · mã "${t.code}" × ${t.n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
