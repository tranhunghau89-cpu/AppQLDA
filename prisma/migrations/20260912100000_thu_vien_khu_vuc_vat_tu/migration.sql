-- Thư viện giai đoạn 2: nhà cung cấp theo khu vực, vật tư master, biến thể công tác,
-- giá mua vật tư. Thêm cột khu vực cho dự án và cho bản dự toán.
--
-- Vì sao Quote có khuVucId RIÊNG chứ không đọc qua Project: một bản dự toán sống được
-- ở CoHoi (cơ hội chào giá), lúc đó chưa có dự án nào để hỏi.
--
-- Vì sao giá mua vật tư tách khỏi đơn giá công tác và không suy ra nhau: giá mua là
-- một SỰ KIỆN về nhà cung cấp, đơn giá công tác là một QUYẾT ĐỊNH của người lập dự
-- toán. Nối bằng công thức sẽ làm giá bán nhảy mỗi lần ai đó cập nhật báo giá vật tư.
--
-- Toàn bộ là THÊM MỚI — không DROP, không đổi cột cũ, không đụng EstimateItem.
-- Ba cột thêm vào bảng có sẵn đều NULL và không DEFAULT nên Postgres không viết lại
-- bảng, dòng cũ nhận NULL.

-- CreateTable
CREATE TABLE IF NOT EXISTS "NhaCungCapKhuVuc" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "khuVucId" TEXT NOT NULL,
    "uuTien" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NhaCungCapKhuVuc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VatTu" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "quyCach" TEXT,
    "hang" TEXT,
    "xuatXu" TEXT,
    "donVi" TEXT,
    "nhomTSKT" TEXT NOT NULL DEFAULT 'A',
    "tag" TEXT,
    "inTrongMoTa" BOOLEAN NOT NULL DEFAULT false,
    "nhomChiPhi" TEXT NOT NULL DEFAULT 'KHAC',
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatTu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CongTacVatTu" (
    "id" TEXT NOT NULL,
    "congTacId" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "tenBienThe" TEXT,
    "laMacDinh" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CongTacVatTu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GiaMuaVatTu" (
    "id" TEXT NOT NULL,
    "vatTuId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "khuVucId" TEXT,
    "donGia" DOUBLE PRECISION NOT NULL,
    "donVi" TEXT,
    "hieuLucTu" TIMESTAMP(3) NOT NULL,
    "nguon" TEXT NOT NULL DEFAULT 'NHAP_TAY',
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "GiaMuaVatTu_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "khuVucId" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "khuVucId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NhaCungCapKhuVuc_supplierId_khuVucId_key" ON "NhaCungCapKhuVuc"("supplierId", "khuVucId");
CREATE INDEX IF NOT EXISTS "NhaCungCapKhuVuc_khuVucId_uuTien_idx" ON "NhaCungCapKhuVuc"("khuVucId", "uuTien");

CREATE UNIQUE INDEX IF NOT EXISTS "VatTu_ma_key" ON "VatTu"("ma");
CREATE INDEX IF NOT EXISTS "VatTu_nhomTSKT_sortOrder_idx" ON "VatTu"("nhomTSKT", "sortOrder");
CREATE INDEX IF NOT EXISTS "VatTu_tag_idx" ON "VatTu"("tag");
CREATE INDEX IF NOT EXISTS "VatTu_active_idx" ON "VatTu"("active");

CREATE UNIQUE INDEX IF NOT EXISTS "CongTacVatTu_congTacId_vatTuId_key" ON "CongTacVatTu"("congTacId", "vatTuId");
CREATE INDEX IF NOT EXISTS "CongTacVatTu_vatTuId_idx" ON "CongTacVatTu"("vatTuId");

CREATE INDEX IF NOT EXISTS "GiaMuaVatTu_vatTuId_hieuLucTu_idx" ON "GiaMuaVatTu"("vatTuId", "hieuLucTu");
CREATE INDEX IF NOT EXISTS "GiaMuaVatTu_supplierId_hieuLucTu_idx" ON "GiaMuaVatTu"("supplierId", "hieuLucTu");
CREATE INDEX IF NOT EXISTS "GiaMuaVatTu_khuVucId_idx" ON "GiaMuaVatTu"("khuVucId");

CREATE INDEX IF NOT EXISTS "Project_khuVucId_idx" ON "Project"("khuVucId");
CREATE INDEX IF NOT EXISTS "Quote_khuVucId_idx" ON "Quote"("khuVucId");

-- AddForeignKey
ALTER TABLE "NhaCungCapKhuVuc"
    ADD CONSTRAINT "NhaCungCapKhuVuc_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NhaCungCapKhuVuc"
    ADD CONSTRAINT "NhaCungCapKhuVuc_khuVucId_fkey"
    FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CongTacVatTu"
    ADD CONSTRAINT "CongTacVatTu_congTacId_fkey"
    FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CongTacVatTu"
    ADD CONSTRAINT "CongTacVatTu_vatTuId_fkey"
    FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiaMuaVatTu"
    ADD CONSTRAINT "GiaMuaVatTu_vatTuId_fkey"
    FOREIGN KEY ("vatTuId") REFERENCES "VatTu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiaMuaVatTu"
    ADD CONSTRAINT "GiaMuaVatTu_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GiaMuaVatTu"
    ADD CONSTRAINT "GiaMuaVatTu_khuVucId_fkey"
    FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Khóa ngoại của cột biến thể trên bảng đơn giá. Cột đã có từ giai đoạn trước, lúc đó
-- là tham chiếu mềm vì bảng CongTacVatTu chưa tồn tại; giờ mới siết được.
ALTER TABLE "DonGiaCongTac"
    ADD CONSTRAINT "DonGiaCongTac_congTacVatTuId_fkey"
    FOREIGN KEY ("congTacVatTuId") REFERENCES "CongTacVatTu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project"
    ADD CONSTRAINT "Project_khuVucId_fkey"
    FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_khuVucId_fkey"
    FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
