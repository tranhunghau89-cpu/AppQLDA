import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Next cung cấp "server-only" lúc build; ngoài Next thì không resolve được.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    // Chỉ test logic thuần (không chạm DB / React) — xem plan/23.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
