-- Mục con dự toán thi công (dự toán / thực tế) + cờ ghi đè thực tế trên dòng cha.
ALTER TABLE "EstimateItem" ADD COLUMN "actualAmount" DOUBLE PRECISION;
ALTER TABLE "EstimateItem" ADD COLUMN "thucTeGhiDe" BOOLEAN NOT NULL DEFAULT false;
-- Số thực đã gõ tay từ trước là ghi đè có chủ ý: mục con thêm sau không được xoá nó.
UPDATE "EstimateItem" SET "thucTeGhiDe" = true
  WHERE "actualQty" IS NOT NULL OR "actualUnitPrice" IS NOT NULL;

CREATE TABLE "MucConDuToan" (
    "id" TEXT NOT NULL,
    "estimateItemId" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "donVi" TEXT,
    "khoiLuong" DOUBLE PRECISION,
    "donGia" DOUBLE PRECISION,
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MucConDuToan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MucConDuToan_estimateItemId_loai_sortOrder_idx" ON "MucConDuToan"("estimateItemId", "loai", "sortOrder");
ALTER TABLE "MucConDuToan" ADD CONSTRAINT "MucConDuToan_estimateItemId_fkey" FOREIGN KEY ("estimateItemId") REFERENCES "EstimateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
