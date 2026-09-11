-- Thư viện mẫu báo giá gửi khách: bảng chính + 4 bảng con (dòng hạng mục, vật liệu
-- & TSKT, tiến độ thi công, tiến độ thanh toán) — đúng bộ bảng con của ClientQuote,
-- trừ những cột chỉ có nghĩa với một dự án cụ thể (qty, amount, sourceSectionId).
--
-- Vì sao KHÔNG dùng chung EstimateTemplate: mẫu dự toán mô tả khối lượng vật tư để
-- tính giá thành nội bộ, mẫu này mô tả một VĂN BẢN gửi ra ngoài (lời chào, điều
-- khoản, bảng vật liệu). Hai vòng đời và hai bộ cột khác hẳn nhau.
--
-- ClientQuote.templateId là tham chiếu MỀM (không có khóa ngoại): xóa một mẫu không
-- được phép kéo theo báo giá đã phát hành cho khách.
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi cột bảng cũ — nên chạy
-- được trên cơ sở dữ liệu đang phục vụ mà không cần dừng hệ thống, và chạy lại được.

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buildingType" TEXT,
    "description" TEXT,
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

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "partCode" TEXT NOT NULL DEFAULT 'I',
    "partName" TEXT NOT NULL DEFAULT 'Phần kết cấu thép',
    "code" TEXT,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "unit" TEXT DEFAULT 'm2',
    "note" TEXT,
    "defaultUnitPrice" DOUBLE PRECISION,
    "tags" TEXT[],
    "sourceSectionCode" TEXT,
    "steelFrameKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteTemplateSpec" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL DEFAULT 'A',
    "tag" TEXT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "origin" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteTemplateSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteTemplateStage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteTemplateStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteTemplatePayment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    "basis" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteTemplatePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteTemplate_buildingType_idx" ON "QuoteTemplate"("buildingType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteTemplateLine_templateId_idx" ON "QuoteTemplateLine"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteTemplateSpec_templateId_idx" ON "QuoteTemplateSpec"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteTemplateStage_templateId_idx" ON "QuoteTemplateStage"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteTemplatePayment_templateId_idx" ON "QuoteTemplatePayment"("templateId");

-- AddForeignKey
ALTER TABLE "QuoteTemplateLine" ADD CONSTRAINT "QuoteTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateSpec" ADD CONSTRAINT "QuoteTemplateSpec_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateStage" ADD CONSTRAINT "QuoteTemplateStage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplatePayment" ADD CONSTRAINT "QuoteTemplatePayment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

