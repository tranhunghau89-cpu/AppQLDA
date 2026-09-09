/**
 * Gán thành viên dự án hàng loạt — chạy MỘT LẦN khi triển khai Phase 21.
 *
 * Bối cảnh: trước Phase 21, mọi người đăng nhập đều thấy tất cả dự án vì bảng
 * `ProjectMember` chưa được dùng để lọc. Sau Phase 21, ai không được gán sẽ
 * không thấy dự án nào. Script này giữ nguyên hiện trạng (mọi user thấy mọi dự
 * án) để không gián đoạn công việc, rồi ADMIN thu hẹp dần trên UI.
 *
 *   npm run members:backfill -- --dry-run     # xem trước, không ghi
 *   npm run members:backfill                  # gán tất cả user × tất cả dự án
 *   npm run members:backfill -- --role=SALES  # chỉ gán cho một vai trò
 *
 * Chạy lại nhiều lần không nhân đôi (bỏ qua cặp đã có).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { isValidRole, ROLES } from "../src/lib/rbac";

const db = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const roleArg = args.find((a) => a.startsWith("--role="))?.split("=")[1];

  if (roleArg && !isValidRole(roleArg)) {
    console.error(`Vai trò không hợp lệ: ${roleArg}. Hợp lệ: ${ROLES.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  // ADMIN thấy tất cả dự án mà không cần gán -> loại khỏi danh sách khi không lọc vai trò.
  const users = await db.user.findMany({
    where: {
      active: true,
      role: roleArg ?? { not: "ADMIN" },
    },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { email: "asc" },
  });
  const projects = await db.project.findMany({
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  if (users.length === 0) {
    console.log("Không có user nào khớp điều kiện — không làm gì.");
    return;
  }
  console.log(`${users.length} user × ${projects.length} dự án`);
  for (const u of users) console.log(`  - ${u.email} (${u.role})`);

  const existing = await db.projectMember.findMany({
    select: { projectId: true, userId: true },
  });
  const have = new Set(existing.map((m) => `${m.projectId}:${m.userId}`));

  const toCreate: { projectId: string; userId: string }[] = [];
  for (const u of users) {
    for (const p of projects) {
      if (!have.has(`${p.id}:${u.id}`)) toCreate.push({ projectId: p.id, userId: u.id });
    }
  }

  console.log(`Đã có ${have.size} liên kết; cần thêm ${toCreate.length}.`);
  if (dryRun) {
    console.log("--dry-run: KHÔNG ghi gì vào DB.");
    return;
  }
  if (toCreate.length === 0) return;

  const res = await db.projectMember.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`Đã tạo ${res.count} liên kết thành viên dự án.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
