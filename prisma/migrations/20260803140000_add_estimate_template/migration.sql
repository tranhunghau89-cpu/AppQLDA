-- AlterTable
ALTER TABLE "EstimateItem" ADD COLUMN     "groupLabel" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- CreateTable
CREATE TABLE "EstimateTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "groupLabel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "defaultUnitPrice" DOUBLE PRECISION,
    "role" TEXT NOT NULL,
    "feedsParam" TEXT,
    "takesFromParam" TEXT,
    "factor" DOUBLE PRECISION DEFAULT 1,
    "defaultQty" DOUBLE PRECISION,
    "groupCode" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EstimateTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "templateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimateTemplateLine_templateId_idx" ON "EstimateTemplateLine"("templateId");

-- CreateIndex
CREATE INDEX "EstimateSection_projectId_idx" ON "EstimateSection"("projectId");

-- CreateIndex
CREATE INDEX "EstimateItem_sectionId_idx" ON "EstimateItem"("sectionId");

-- AddForeignKey
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "EstimateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateTemplateLine" ADD CONSTRAINT "EstimateTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EstimateTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateSection" ADD CONSTRAINT "EstimateSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
