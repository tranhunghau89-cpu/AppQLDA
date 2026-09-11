-- Dự toán chi tiết sống được ở cơ hội chào giá, không chỉ ở dự án.
--
-- Bỏ NOT NULL của "projectId": ở giai đoạn chào giá chưa có dự án nào để trỏ tới. Mọi
-- dòng đang có đều giữ nguyên projectId, nên không cần backfill.
-- Thêm "coHoiId": chủ sở hữu thay thế. Ứng dụng giữ luật "chỉ một trong hai".
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "coHoiId" TEXT;
ALTER TABLE "Quote" ALTER COLUMN "projectId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Quote_coHoiId_idx" ON "Quote"("coHoiId");

-- Xóa cơ hội thì dự toán của nó đi theo — dự toán không có chủ là dự toán không ai
-- nhìn thấy. Cơ hội đã thành dự án thì ứng dụng đã chặn xóa từ trước.
DO $$
BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_coHoiId_fkey"
    FOREIGN KEY ("coHoiId") REFERENCES "CoHoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
