-- Đóng băng giá thư viện trên từng dòng dự toán chào giá.
--
-- Dòng báo giá chụp lại đơn giá tại thời điểm lập. Thư viện đổi giá không bao giờ tự
-- sửa một báo giá đã lập — người lập thấy huy hiệu lệch giá và tự quyết. Cột donGiaId
-- mới là ảnh chụp thật: nó nói được "lấy từ bản giá nào, hiệu lực từ ngày nào", chứ
-- không chỉ một con số.
--
-- Sáu cột thêm vào QuoteItem đều NULL (trừ cờ boolean có DEFAULT false), nên 72 dòng
-- đang có nhận giá trị rỗng và không có gì phải backfill: một dòng gõ tay từ đầu thì
-- đúng là không có gì để chụp.
--
-- KHÔNG đụng EstimateItem.

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "congTacId" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "congTacVatTuId" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "donGiaId" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "donGiaThuVien" DOUBLE PRECISION;
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "chotGiaLuc" TIMESTAMP(3);
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "giaSuaTay" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteItem_congTacId_idx" ON "QuoteItem"("congTacId");

-- AddForeignKey
--
-- Cả ba đều SET NULL chứ không CASCADE: xóa một công tác hay một bản giá khỏi thư
-- viện KHÔNG được phép xóa dòng báo giá đã lập. Dòng đó mất đường tra ngược về thư
-- viện, nhưng vẫn giữ nguyên tên, khối lượng và số tiền đã chốt — đó mới là thứ khách
-- hàng đã nhìn thấy.
ALTER TABLE "QuoteItem"
    ADD CONSTRAINT "QuoteItem_congTacId_fkey"
    FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteItem"
    ADD CONSTRAINT "QuoteItem_congTacVatTuId_fkey"
    FOREIGN KEY ("congTacVatTuId") REFERENCES "CongTacVatTu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteItem"
    ADD CONSTRAINT "QuoteItem_donGiaId_fkey"
    FOREIGN KEY ("donGiaId") REFERENCES "DonGiaCongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
