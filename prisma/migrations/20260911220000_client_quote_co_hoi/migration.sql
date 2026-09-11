-- Báo giá gửi khách sống được ở cơ hội chào giá, không chỉ ở dự án.
-- Cùng luật "chỉ một trong hai" như Quote; mọi dòng đang có đều giữ nguyên projectId.
ALTER TABLE "ClientQuote" ADD COLUMN IF NOT EXISTS "coHoiId" TEXT;
ALTER TABLE "ClientQuote" ALTER COLUMN "projectId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ClientQuote_coHoiId_idx" ON "ClientQuote"("coHoiId");

DO $$
BEGIN
  ALTER TABLE "ClientQuote" ADD CONSTRAINT "ClientQuote_coHoiId_fkey"
    FOREIGN KEY ("coHoiId") REFERENCES "CoHoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
