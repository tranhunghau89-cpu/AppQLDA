import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const USERS = [
  { email: "admin@cty.com", name: "Quản trị viên", role: "ADMIN" },
  { email: "sales@cty.com", name: "Phòng Kinh doanh", role: "SALES" },
  { email: "kythuat@cty.com", name: "Phòng Kỹ thuật", role: "ENGINEERING" },
  { email: "vattu@cty.com", name: "Phòng Vật tư", role: "PROCUREMENT" },
];

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { ...u, passwordHash },
    });
  }

  console.log(`Seed xong ${USERS.length} user (mật khẩu: 123456)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
