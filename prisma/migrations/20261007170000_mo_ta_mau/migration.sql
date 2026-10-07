-- CreateTable
CREATE TABLE "MoTaMau" (
    "id" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoTaMau_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoTaMau_createdAt_idx" ON "MoTaMau"("createdAt");
