-- Báo giá gửi khách: bảng chính + 4 bảng con (dòng hạng mục, vật liệu & TSKT,
-- tiến độ thi công, tiến độ thanh toán).
--
-- Vì sao là bảng RIÊNG chứ không phải một cột kind trên Quote: hiện có 5 chỗ cộng
-- tiền trên MỌI Quote trong phạm vi mà không lọc gì (trang /quotes, trang dự án lấy
-- báo giá mới nhất, danh sách trong trình soạn, nguồn clone, pushSalePrice). Gộp
-- chung thì một bản m² vừa tạo sẽ thành báo giá mới nhất và hiện 0 đ trên dashboard.
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi cột bảng cũ — nên chạy
-- được trên cơ sở dữ liệu đang phục vụ mà không cần dừng hệ thống.

-- CreateTable
CREATE TABLE "ClientQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoteNo" TEXT,
    "title" TEXT NOT NULL,
    "quoteDate" TIMESTAMP(3),
    "customerId" TEXT,
    "recipient" TEXT,
    "customerPhone" TEXT,
    "location" TEXT,
    "scope" TEXT,
    "salesName" TEXT,
    "salesPhone" TEXT,
    "salesEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NHAP',
    "sentDate" TIMESTAMP(3),
    "validDays" INTEGER DEFAULT 7,
    "expiryDate" TIMESTAMP(3),
    "vatPercent" DOUBLE PRECISION DEFAULT 10,
    "warrantyMonths" INTEGER DEFAULT 12,
    "maintenanceMonths" INTEGER DEFAULT 120,
    "loadRoof" DOUBLE PRECISION,
    "loadHanging" DOUBLE PRECISION,
    "loadFloor" DOUBLE PRECISION,
    "greeting" TEXT,
    "closing" TEXT,
    "colorNote" TEXT,
    "volumeNote" TEXT,
    "excludeNote" TEXT,
    "templateId" TEXT,
    "derivedFromId" TEXT,
    "clonedFromId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "partCode" TEXT NOT NULL DEFAULT 'I',
    "partName" TEXT NOT NULL DEFAULT 'Phần kết cấu thép',
    "code" TEXT,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "unit" TEXT DEFAULT 'm2',
    "qty" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "note" TEXT,
    "sourceSectionId" TEXT,
    "priceOverridden" BOOLEAN NOT NULL DEFAULT false,
    "steelFrameKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuoteSpec" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL DEFAULT 'A',
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "origin" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientQuoteSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuoteStage" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientQuoteStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientQuotePayment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "basis" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClientQuotePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuote_projectId_idx" ON "ClientQuote"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuote_customerId_idx" ON "ClientQuote"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuote_status_expiryDate_idx" ON "ClientQuote"("status", "expiryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuoteLine_quoteId_idx" ON "ClientQuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuoteSpec_quoteId_idx" ON "ClientQuoteSpec"("quoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuoteStage_quoteId_idx" ON "ClientQuoteStage"("quoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientQuotePayment_quoteId_idx" ON "ClientQuotePayment"("quoteId");

-- AddForeignKey
ALTER TABLE "ClientQuote" ADD CONSTRAINT "ClientQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuote" ADD CONSTRAINT "ClientQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuote" ADD CONSTRAINT "ClientQuote_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuote" ADD CONSTRAINT "ClientQuote_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "ClientQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuoteLine" ADD CONSTRAINT "ClientQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ClientQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuoteSpec" ADD CONSTRAINT "ClientQuoteSpec_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ClientQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuoteStage" ADD CONSTRAINT "ClientQuoteStage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ClientQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientQuotePayment" ADD CONSTRAINT "ClientQuotePayment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ClientQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

