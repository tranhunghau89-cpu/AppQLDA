-- Thu hồi phiên đăng nhập: token mang tokenVersion, lệch với DB -> bị từ chối.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
