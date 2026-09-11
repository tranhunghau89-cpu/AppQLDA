-- Mô tả chung của hạng mục trên báo giá gửi khách.
--
-- Trong báo giá mẫu, hai gạch đầu dòng "- Gia công sản xuất theo bản vẽ thiết kế."
-- và "- Tôn mái là tôn Đông Á ..." lặp y hệt ở cả bốn hạng mục. Để một chỗ rồi dùng
-- chung, thay vì bắt người lập gõ lại từng dòng; dòng nào cần khác thì điền
-- ClientQuoteLine.detail để đè lên.
--
-- Cột cho phép NULL nên không cần giá trị mặc định cho dữ liệu đang có.

ALTER TABLE "ClientQuote" ADD COLUMN IF NOT EXISTS "lineDetail" TEXT;
