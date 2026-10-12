ALTER TABLE "Project" ADD COLUMN "mauSon" TEXT;
ALTER TABLE "Project" ADD COLUMN "mauTonMai" TEXT;
ALTER TABLE "Project" ADD COLUMN "mauTonVach" TEXT;
ALTER TABLE "Project" ADD COLUMN "ghiChuVatTu" TEXT;

CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectContact_projectId_idx" ON "ProjectContact"("projectId");
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectMaterialSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tag" TEXT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "origin" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectMaterialSpec_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectMaterialSpec_projectId_idx" ON "ProjectMaterialSpec"("projectId");
ALTER TABLE "ProjectMaterialSpec" ADD CONSTRAINT "ProjectMaterialSpec_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
