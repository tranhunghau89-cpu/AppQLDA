-- Gộp tay đầu việc cho trang so sánh dự án. Chỉ thêm bảng.
CREATE TABLE "GopDauViec" (
    "khoaNguon" TEXT NOT NULL,
    "khoaDich" TEXT NOT NULL,
    "tenNguon" TEXT,
    "tenDich" TEXT,
    "nguoiGop" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GopDauViec_pkey" PRIMARY KEY ("khoaNguon")
);
CREATE INDEX "GopDauViec_khoaDich_idx" ON "GopDauViec"("khoaDich");
