-- Thuế mặc định 8%.
ALTER TABLE "ClientQuote" ALTER COLUMN "vatPercent" SET DEFAULT 8;
ALTER TABLE "QuoteTemplate" ALTER COLUMN "vatPercent" SET DEFAULT 8;
ALTER TABLE "BoHangMuc" ALTER COLUMN "vatPercent" SET DEFAULT 8;
-- Bộ hạng mục đang để mặc định cũ 10% thì đổi theo; bộ đặt giá trị khác giữ nguyên.
UPDATE "BoHangMuc" SET "vatPercent" = 8 WHERE "vatPercent" = 10;

-- Ẩn dòng quy cách vật tư khỏi bản in.
ALTER TABLE "ClientQuoteSpec" ADD COLUMN "an" BOOLEAN NOT NULL DEFAULT false;
