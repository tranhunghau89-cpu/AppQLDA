-- Bộ hạng mục chuẩn: khung hạng mục theo loại công trình.
--
-- Gộp EstimateTemplate và QuoteTemplate vào MỘT bảng vì chúng mô tả cùng một công
-- trình từ hai phía: mẫu dự toán là các dòng CHI PHÍ, mẫu báo giá là các dòng IN CHO
-- KHÁCH. Một BoHangMucPhan là khuôn QuoteSection (nội bộ) VÀ khuôn ClientQuoteLine
-- (gửi khách) — hết cảnh sourceSectionCode trỏ bằng chuỗi giữa hai bảng rời nhau.
--
-- Bốn cột tham số của BoHangMucDong (vaiTro/napThamSo/layTuThamSo/heSoQuyDoi) giữ
-- nguyên nghĩa của EstimateTemplateLine, để computeTemplateLines dùng lại không sửa.
--
-- Toàn bộ là THÊM MỚI. Hai bảng mẫu cũ KHÔNG bị đụng tới ở bước này — chúng chỉ bị
-- xóa ở một release riêng sau khi bộ hạng mục đã chạy đủ lâu. KHÔNG đụng EstimateItem.

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMuc" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loaiCongTrinh" TEXT,
    "moTa" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vatPercent" DOUBLE PRECISION DEFAULT 10,
    "validDays" INTEGER DEFAULT 7,
    "warrantyMonths" INTEGER DEFAULT 12,
    "maintenanceMonths" INTEGER DEFAULT 120,
    "loadRoof" DOUBLE PRECISION,
    "loadHanging" DOUBLE PRECISION,
    "loadFloor" DOUBLE PRECISION,
    "lineDetail" TEXT,
    "greeting" TEXT,
    "closing" TEXT,
    "colorNote" TEXT,
    "volumeNote" TEXT,
    "excludeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoHangMuc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMucPhan" (
    "id" TEXT NOT NULL,
    "boHangMucId" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loai" TEXT NOT NULL DEFAULT 'PHAN',
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "inChoKhach" BOOLEAN NOT NULL DEFAULT true,
    "partCode" TEXT NOT NULL DEFAULT 'I',
    "partName" TEXT NOT NULL DEFAULT 'Phần kết cấu thép',
    "maKhach" TEXT,
    "tenKhachHang" TEXT,
    "moTaKhachHang" TEXT,
    "donViKhach" TEXT DEFAULT 'm2',
    "donGiaKhach" DOUBLE PRECISION,
    "ghiChuKhach" TEXT,
    "tags" TEXT[],
    "steelFrameKey" TEXT,

    CONSTRAINT "BoHangMucPhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMucDong" (
    "id" TEXT NOT NULL,
    "boHangMucId" TEXT NOT NULL,
    "phanId" TEXT,
    "congTacId" TEXT,
    "congTacVatTuId" TEXT,
    "maCongTac" TEXT,
    "ten" TEXT NOT NULL,
    "donVi" TEXT,
    "donGiaMacDinh" DOUBLE PRECISION,
    "khoiLuongMacDinh" DOUBLE PRECISION,
    "groupLabel" TEXT,
    "nhomChiPhi" TEXT NOT NULL DEFAULT 'KHAC',
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vaiTro" TEXT NOT NULL DEFAULT 'INPUT',
    "napThamSo" TEXT,
    "layTuThamSo" TEXT,
    "heSoQuyDoi" DOUBLE PRECISION DEFAULT 1,

    CONSTRAINT "BoHangMucDong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMucVatTu" (
    "id" TEXT NOT NULL,
    "boHangMucId" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoHangMucVatTu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMucGiaiDoan" (
    "id" TEXT NOT NULL,
    "boHangMucId" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "soNgay" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoHangMucGiaiDoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BoHangMucThanhToan" (
    "id" TEXT NOT NULL,
    "boHangMucId" TEXT NOT NULL,
    "nhan" TEXT NOT NULL,
    "phanTram" DOUBLE PRECISION,
    "canCu" TEXT,
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoHangMucThanhToan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BoHangMuc_ma_key" ON "BoHangMuc"("ma");
CREATE INDEX IF NOT EXISTS "BoHangMuc_loaiCongTrinh_idx" ON "BoHangMuc"("loaiCongTrinh");
CREATE INDEX IF NOT EXISTS "BoHangMuc_active_sortOrder_idx" ON "BoHangMuc"("active", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "BoHangMucPhan_boHangMucId_ma_key" ON "BoHangMucPhan"("boHangMucId", "ma");
CREATE INDEX IF NOT EXISTS "BoHangMucPhan_parentId_idx" ON "BoHangMucPhan"("parentId");

CREATE INDEX IF NOT EXISTS "BoHangMucDong_boHangMucId_sortOrder_idx" ON "BoHangMucDong"("boHangMucId", "sortOrder");
CREATE INDEX IF NOT EXISTS "BoHangMucDong_phanId_idx" ON "BoHangMucDong"("phanId");
CREATE INDEX IF NOT EXISTS "BoHangMucDong_congTacId_idx" ON "BoHangMucDong"("congTacId");

CREATE UNIQUE INDEX IF NOT EXISTS "BoHangMucVatTu_boHangMucId_vatTuId_key" ON "BoHangMucVatTu"("boHangMucId", "vatTuId");
CREATE INDEX IF NOT EXISTS "BoHangMucVatTu_boHangMucId_sortOrder_idx" ON "BoHangMucVatTu"("boHangMucId", "sortOrder");

CREATE INDEX IF NOT EXISTS "BoHangMucGiaiDoan_boHangMucId_sortOrder_idx" ON "BoHangMucGiaiDoan"("boHangMucId", "sortOrder");
CREATE INDEX IF NOT EXISTS "BoHangMucThanhToan_boHangMucId_sortOrder_idx" ON "BoHangMucThanhToan"("boHangMucId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BoHangMucPhan"
    ADD CONSTRAINT "BoHangMucPhan_boHangMucId_fkey"
    FOREIGN KEY ("boHangMucId") REFERENCES "BoHangMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoHangMucPhan"
    ADD CONSTRAINT "BoHangMucPhan_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "BoHangMucPhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoHangMucDong"
    ADD CONSTRAINT "BoHangMucDong_boHangMucId_fkey"
    FOREIGN KEY ("boHangMucId") REFERENCES "BoHangMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL chứ không CASCADE: xóa một PHẦN không được kéo theo các dòng công tác
-- trong đó — chúng chỉ rơi ra ngoài cây, và người soạn gắn lại được.
ALTER TABLE "BoHangMucDong"
    ADD CONSTRAINT "BoHangMucDong_phanId_fkey"
    FOREIGN KEY ("phanId") REFERENCES "BoHangMucPhan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BoHangMucDong"
    ADD CONSTRAINT "BoHangMucDong_congTacId_fkey"
    FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BoHangMucDong"
    ADD CONSTRAINT "BoHangMucDong_congTacVatTuId_fkey"
    FOREIGN KEY ("congTacVatTuId") REFERENCES "CongTacVatTu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BoHangMucVatTu"
    ADD CONSTRAINT "BoHangMucVatTu_boHangMucId_fkey"
    FOREIGN KEY ("boHangMucId") REFERENCES "BoHangMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoHangMucVatTu"
    ADD CONSTRAINT "BoHangMucVatTu_vatTuId_fkey"
    FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoHangMucGiaiDoan"
    ADD CONSTRAINT "BoHangMucGiaiDoan_boHangMucId_fkey"
    FOREIGN KEY ("boHangMucId") REFERENCES "BoHangMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoHangMucThanhToan"
    ADD CONSTRAINT "BoHangMucThanhToan_boHangMucId_fkey"
    FOREIGN KEY ("boHangMucId") REFERENCES "BoHangMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
