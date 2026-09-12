-- Thư viện dùng chung: Khu vực, Công tác, Đơn giá công tác.
--
-- Vì sao đơn giá tách khỏi công tác: một công tác có nhiều giá theo thời điểm và
-- theo khu vực. Bảng WorkPrice cũ chỉ giữ một con số nên sửa giá là mất giá cũ, và
-- câu "ngày ký báo giá đó đơn giá bao nhiêu" không trả lời được.
--
-- KhuVuc tạo rỗng ở bước này, chưa có giao diện. Dựng sẵn để DonGiaCongTac.khuVucId
-- có chỗ trỏ ngay từ đầu — thêm cột khóa ngoại vào một bảng đã có dữ liệu tốn kém
-- hơn nhiều so với tạo sẵn một bảng rỗng.
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi cột bảng cũ — nên chạy
-- được trên cơ sở dữ liệu đang phục vụ và chạy lại được.

-- CreateTable
CREATE TABLE IF NOT EXISTS "KhuVuc" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KhuVuc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CongTac" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "tenNgan" TEXT,
    "quyCach" TEXT,
    "donVi" TEXT,
    "nhomMa" TEXT NOT NULL DEFAULT 'AA',
    "nhomChiPhi" TEXT NOT NULL DEFAULT 'KHAC',
    "heSo" DOUBLE PRECISION,
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CongTac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DonGiaCongTac" (
    "id" TEXT NOT NULL,
    "congTacId" TEXT NOT NULL,
    "congTacVatTuId" TEXT,
    "khuVucId" TEXT,
    "vatTu" DOUBLE PRECISION,
    "nhanCongMay" DOUBLE PRECISION,
    "heSo" DOUBLE PRECISION,
    "donGia" DOUBLE PRECISION NOT NULL,
    "hieuLucTu" TIMESTAMP(3) NOT NULL,
    "nguon" TEXT NOT NULL DEFAULT 'NHAP_TAY',
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "DonGiaCongTac_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KhuVuc_ma_key" ON "KhuVuc"("ma");
CREATE INDEX IF NOT EXISTS "KhuVuc_active_sortOrder_idx" ON "KhuVuc"("active", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "CongTac_ma_key" ON "CongTac"("ma");
CREATE INDEX IF NOT EXISTS "CongTac_nhomMa_sortOrder_idx" ON "CongTac"("nhomMa", "sortOrder");
CREATE INDEX IF NOT EXISTS "CongTac_active_idx" ON "CongTac"("active");

CREATE INDEX IF NOT EXISTS "DonGiaCongTac_congTacId_hieuLucTu_idx" ON "DonGiaCongTac"("congTacId", "hieuLucTu");
CREATE INDEX IF NOT EXISTS "DonGiaCongTac_congTacId_khuVucId_hieuLucTu_idx" ON "DonGiaCongTac"("congTacId", "khuVucId", "hieuLucTu");

-- Chống trùng bản giá: MỘT công tác chỉ được có MỘT bản giá cho cùng một tổ hợp
-- (biến thể, khu vực) tại cùng một ngày hiệu lực.
--
-- Phải viết tay bằng 4 chỉ mục RIÊNG PHẦN chứ không dùng @@unique của Prisma:
-- Postgres coi hai NULL là KHÁC nhau trong ràng buộc UNIQUE, nên một @@unique gộp
-- cả 4 cột sẽ để lọt đúng cái trùng hay xảy ra nhất — hai dòng "giá chung" cùng ngày.
CREATE UNIQUE INDEX IF NOT EXISTS "DonGiaCongTac_chung_key"
    ON "DonGiaCongTac"("congTacId", "hieuLucTu")
    WHERE "congTacVatTuId" IS NULL AND "khuVucId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "DonGiaCongTac_bienThe_key"
    ON "DonGiaCongTac"("congTacId", "congTacVatTuId", "hieuLucTu")
    WHERE "congTacVatTuId" IS NOT NULL AND "khuVucId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "DonGiaCongTac_khuVuc_key"
    ON "DonGiaCongTac"("congTacId", "khuVucId", "hieuLucTu")
    WHERE "congTacVatTuId" IS NULL AND "khuVucId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "DonGiaCongTac_bienThe_khuVuc_key"
    ON "DonGiaCongTac"("congTacId", "congTacVatTuId", "khuVucId", "hieuLucTu")
    WHERE "congTacVatTuId" IS NOT NULL AND "khuVucId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "DonGiaCongTac"
    ADD CONSTRAINT "DonGiaCongTac_congTacId_fkey"
    FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonGiaCongTac"
    ADD CONSTRAINT "DonGiaCongTac_khuVucId_fkey"
    FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
