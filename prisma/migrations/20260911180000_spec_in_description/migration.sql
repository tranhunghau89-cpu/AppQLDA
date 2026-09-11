-- Cờ "nhắc lại dưới tên hạng mục" cho từng dòng vật liệu.
--
-- Trước đây mô tả dưới mỗi hạng mục liệt kê MỌI vật tư đã gắn nhãn cho hạng mục đó,
-- nên hạng mục mái ra 7 gạch đầu dòng (thép tấm, thép hình, tôn mái, máng nước, ke
-- diềm, ống nước...). Báo giá thật của công ty chỉ nêu đúng loại tôn — phần còn lại
-- để bảng "Vật liệu áp dụng và thông số kỹ thuật" ở mục 2 nói.
--
-- Mặc định TẮT: im lặng là mặc định an toàn, bật thêm là quyết định có chủ ý.
--
-- Backfill bật cho đúng các dòng tôn chính của dữ liệu đang có, để những báo giá đã
-- lập giữ nguyên câu "- Tôn mái là tôn ... 0,45 mm" mà không phải sửa tay. Máng
-- nước / ke diềm / ống nước tuy cùng nhãn TON_MAI nhưng không phải thứ khách nhìn
-- vào để biết mình mua gì, nên không bật.
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi cột cũ — nên chạy được
-- trên cơ sở dữ liệu đang phục vụ và chạy lại được.

-- AlterTable
ALTER TABLE "ClientQuoteSpec" ADD COLUMN IF NOT EXISTS "inDescription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuoteTemplateSpec" ADD COLUMN IF NOT EXISTS "inDescription" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: dòng tôn chính của mái và của thưng.
UPDATE "ClientQuoteSpec"
   SET "inDescription" = true
 WHERE "tag" IN ('TON_MAI', 'TON_THUNG')
   AND "name" ILIKE 'Tôn %';

UPDATE "QuoteTemplateSpec"
   SET "inDescription" = true
 WHERE "tag" IN ('TON_MAI', 'TON_THUNG')
   AND "name" ILIKE 'Tôn %';
