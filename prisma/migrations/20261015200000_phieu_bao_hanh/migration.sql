-- Phiếu bảo hành dự án. Chỉ thêm bảng mới.
CREATE TABLE "PhieuBaoHanh" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tieuDe" TEXT NOT NULL,
    "moTa" TEXT,
    "viTri" TEXT,
    "nguoiBao" TEXT,
    "ngayBao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mucDo" TEXT NOT NULL DEFAULT 'THUONG',
    "phuTrachId" TEXT,
    "hanXuLy" TIMESTAMP(3),
    "trangThai" TEXT NOT NULL DEFAULT 'MOI',
    "ketQua" TEXT,
    "xongLuc" TIMESTAMP(3),
    "taoBoiId" TEXT NOT NULL,
    "taoBoiTen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhieuBaoHanh_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhieuBaoHanh_projectId_trangThai_idx" ON "PhieuBaoHanh"("projectId", "trangThai");
CREATE INDEX "PhieuBaoHanh_trangThai_hanXuLy_idx" ON "PhieuBaoHanh"("trangThai", "hanXuLy");

ALTER TABLE "PhieuBaoHanh" ADD CONSTRAINT "PhieuBaoHanh_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
