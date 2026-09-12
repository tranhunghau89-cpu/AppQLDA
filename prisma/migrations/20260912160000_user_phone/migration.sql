-- Số điện thoại của tài khoản.
--
-- Bản báo giá gửi khách in "Người phụ trách / SĐT / Email". Tên và email vốn đã lấy
-- thẳng từ tài khoản lúc tạo báo giá, riêng SĐT thì không có nguồn nào nên phải gõ tay
-- từng bản — và gõ tay thì có bản quên, khách cầm tờ giấy không biết gọi cho ai.
--
-- Nullable: 5 tài khoản đang có chưa ai khai số, và bắt buộc ngay sẽ chặn đăng nhập.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
