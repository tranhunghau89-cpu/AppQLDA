-- AlterTable: PurchaseOrder them ngay du kien giao
ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDate" TIMESTAMP(3);

-- Chuan hoa danh muc don hang ve 4 nhom: KCT | XA_GO | TON | VTP
UPDATE "PurchaseOrder" SET "category" = 'VTP' WHERE "category" IN ('BL', 'PANEL', 'CUALUA', 'PK', 'KHAC');

-- CreateTable
CREATE TABLE "DocVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocVersion_projectId_docType_createdAt_idx" ON "DocVersion"("projectId", "docType", "createdAt");

-- AddForeignKey
ALTER TABLE "DocVersion" ADD CONSTRAINT "DocVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
