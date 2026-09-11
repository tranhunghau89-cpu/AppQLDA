-- Nối hạng mục (mục 1) với bảng vật liệu (mục 2) bằng nhãn loại vật tư.
--
-- Trước đây bảng vật liệu là một danh sách phẳng, in nguyên 16 dòng bất kể báo giá
-- có bán hạng mục đó hay không — báo giá không có thưng vách vẫn in "Tôn thưng".
--
-- Nay mỗi dòng vật liệu mang một nhãn, mỗi hạng mục khai nó dùng nhãn nào, và khi in
-- chỉ giữ lại dòng có nhãn thuộc một hạng mục đang có. Dòng KHÔNG mang nhãn là vật tư
-- dùng chung (que hàn, sơn, bulong, keo vít) nên luôn in.
--
-- Cả hai cột đều thêm mới và có mặc định an toàn: dữ liệu cũ giữ nguyên hành vi
-- (tags rỗng, tag NULL = luôn in).

ALTER TABLE "ClientQuoteLine" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClientQuoteSpec" ADD COLUMN IF NOT EXISTS "tag" TEXT;
