-- Thư viện đơn hàng mẫu: lưu từ một đơn có sẵn, tạo nhanh đơn cho dự án mới.
CREATE TABLE "PurchaseOrderTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrderTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseOrderTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "category" TEXT,
    "groupName" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "qty" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderTemplateItem_templateId_idx" ON "PurchaseOrderTemplateItem"("templateId");

ALTER TABLE "PurchaseOrderTemplateItem" ADD CONSTRAINT "PurchaseOrderTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PurchaseOrderTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
