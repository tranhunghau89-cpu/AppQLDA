-- Trao đổi dự án: ghim tin "Chú ý". Chỉ thêm cột + chỉ mục.
ALTER TABLE "TraoDoi" ADD COLUMN "ghim" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "TraoDoi_projectId_doiTuong_createdAt_idx" ON "TraoDoi"("projectId", "doiTuong", "createdAt");
