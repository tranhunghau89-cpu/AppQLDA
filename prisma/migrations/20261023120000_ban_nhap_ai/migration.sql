-- Bản nháp do AI đọc từ file (plan/34). Không khóa ngoại, giống AuditLog.
-- CreateTable
CREATE TABLE "BanNhapAi" (
    "id" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "projectId" TEXT,
    "trangThai" TEXT NOT NULL DEFAULT 'DANG_DOC',
    "fileKeys" TEXT[],
    "tenFile" TEXT NOT NULL,
    "ketQuaAi" JSONB,
    "canhBao" JSONB,
    "duLieuDaSua" JSONB,
    "loi" TEXT,
    "model" TEXT,
    "tokenVao" INTEGER,
    "tokenRa" INTEGER,
    "ketQuaId" TEXT,
    "nguoiTaoId" TEXT NOT NULL,
    "nguoiGhiId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BanNhapAi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BanNhapAi_projectId_createdAt_idx" ON "BanNhapAi"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BanNhapAi_nguoiTaoId_trangThai_idx" ON "BanNhapAi"("nguoiTaoId", "trangThai");

