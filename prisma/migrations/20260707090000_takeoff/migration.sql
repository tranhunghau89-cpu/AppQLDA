-- CreateTable
CREATE TABLE "TakeoffItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "group" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "dims" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "concrete" DOUBLE PRECISION,
    "formwork" DOUBLE PRECISION,
    "rebarRatio" DOUBLE PRECISION,
    "rebar" DOUBLE PRECISION,
    "steel" DOUBLE PRECISION,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeoffItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakeoffItem_projectId_kind_idx" ON "TakeoffItem"("projectId", "kind");

-- AddForeignKey
ALTER TABLE "TakeoffItem" ADD CONSTRAINT "TakeoffItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
