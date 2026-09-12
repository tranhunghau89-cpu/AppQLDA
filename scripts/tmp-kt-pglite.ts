import { PrismaClient } from "@prisma/client";
const url = "postgresql://postgres:postgres@127.0.0.1:5433/postgres?connection_limit=1&pool_timeout=60&pgbouncer=true";
async function main() {
  console.log(`DATABASE_URL[0..40] = ${url.slice(0, 40)}`);
  const db = new PrismaClient({ datasourceUrl: url });
  const [q, s, i] = await Promise.all([db.quote.count(), db.quoteSection.count(), db.quoteItem.count()]);
  console.log(`PGlite: ${q} báo giá, ${s} phần, ${i} dòng`);
  await db.$disconnect();
}
main().catch((e) => { console.error(String(e).slice(0, 400)); process.exitCode = 1; });
