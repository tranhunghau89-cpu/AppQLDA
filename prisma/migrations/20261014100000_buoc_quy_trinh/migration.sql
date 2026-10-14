-- Quy trình dự án: mỗi dự án một dòng cho mỗi bước (tạo dần khi mở trang dự án).
CREATE TABLE "BuocQuyTrinh" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "buoc" TEXT NOT NULL,
    "trangThai" TEXT NOT NULL DEFAULT 'DANG_LAM',
    "phuTrachId" TEXT,
    "hanXuLy" TIMESTAMP(3),
    "guiLuc" TIMESTAMP(3),
    "duyetLuc" TIMESTAMP(3),
    "nguoiDuyetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuocQuyTrinh_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BuocQuyTrinh_projectId_buoc_key" ON "BuocQuyTrinh"("projectId", "buoc");
CREATE INDEX "BuocQuyTrinh_phuTrachId_trangThai_idx" ON "BuocQuyTrinh"("phuTrachId", "trangThai");
CREATE INDEX "BuocQuyTrinh_trangThai_idx" ON "BuocQuyTrinh"("trangThai");
ALTER TABLE "BuocQuyTrinh" ADD CONSTRAINT "BuocQuyTrinh_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
