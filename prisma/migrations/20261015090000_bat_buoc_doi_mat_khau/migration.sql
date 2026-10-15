-- Quản trị đặt lại mật khẩu -> người dùng phải tự đổi ở lần đăng nhập kế tiếp.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
