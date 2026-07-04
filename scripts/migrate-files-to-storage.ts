// Chuyển file HĐ/đơn hàng từ ổ đĩa local lên Supabase Storage (chạy 1 lần ở máy còn file gốc).
// - Duyệt Contract.filePath / PurchaseOrder.filePath còn tồn tại trên đĩa → upload bucket → đổi filePath = key Storage.
// - Idempotent: filePath đã là key (không tồn tại trên đĩa) sẽ bị bỏ qua.
// Chạy: npm run migrate:files   (sau khi .env đã có DATABASE_URL + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { uploadFile, isStorageConfigured } from "../src/lib/storage";

// Nạp .env tối thiểu (tsx không tự load) cho các key SUPABASE_*.
for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = new PrismaClient();

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

async function run() {
  if (!isStorageConfigured()) {
    console.error("❌ Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env");
    process.exit(1);
  }

  let uploaded = 0,
    skipped = 0,
    missing = 0;

  async function handle(
    kind: "contracts" | "orders",
    id: string,
    filePath: string | null,
    save: (key: string) => Promise<unknown>
  ) {
    if (!filePath) return;
    if (!fs.existsSync(filePath)) {
      // Đã là key Storage hoặc file gốc đã mất.
      if (/[\\/]|:/.test(filePath) && !filePath.startsWith(`${kind}/`)) missing++;
      else skipped++;
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const key = `${kind}/${id}${ext}`;
    const buf = fs.readFileSync(filePath);
    await uploadFile(key, buf, MIME[ext] ?? "application/octet-stream");
    await save(key);
    uploaded++;
    console.log(`  ↑ ${path.basename(filePath)} → ${key}`);
  }

  const contracts = await db.contract.findMany({ select: { id: true, filePath: true } });
  console.log(`Hợp đồng: ${contracts.length}`);
  for (const c of contracts)
    await handle("contracts", c.id, c.filePath, (key) =>
      db.contract.update({ where: { id: c.id }, data: { filePath: key } })
    );

  const orders = await db.purchaseOrder.findMany({ select: { id: true, filePath: true } });
  console.log(`Đơn hàng: ${orders.length}`);
  for (const o of orders)
    await handle("orders", o.id, o.filePath, (key) =>
      db.purchaseOrder.update({ where: { id: o.id }, data: { filePath: key } })
    );

  console.log(`\n✅ Upload ${uploaded} · bỏ qua ${skipped} (đã ở Storage) · thiếu file gốc ${missing}`);
  await db.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
