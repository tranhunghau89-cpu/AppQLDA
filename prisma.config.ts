// Cấu hình Prisma (thay cho khối "prisma" trong package.json — bị deprecated từ Prisma 7).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
