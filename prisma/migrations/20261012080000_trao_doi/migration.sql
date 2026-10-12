-- CreateTable
CREATE TABLE "TraoDoi" (
    "id" TEXT NOT NULL,
    "doiTuong" TEXT NOT NULL,
    "doiTuongId" TEXT NOT NULL,
    "projectId" TEXT,
    "coHoiId" TEXT,
    "nhanDe" TEXT,
    "loai" TEXT NOT NULL DEFAULT 'GHI_CHU',
    "noiDung" TEXT NOT NULL,
    "tacGiaId" TEXT NOT NULL,
    "tacGiaTen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraoDoi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraoDoiNhan" (
    "id" TEXT NOT NULL,
    "traoDoiId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "daDocLuc" TIMESTAMP(3),

    CONSTRAINT "TraoDoiNhan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraoDoi_doiTuong_doiTuongId_createdAt_idx" ON "TraoDoi"("doiTuong", "doiTuongId", "createdAt");

-- CreateIndex
CREATE INDEX "TraoDoiNhan_userId_daDocLuc_idx" ON "TraoDoiNhan"("userId", "daDocLuc");

-- CreateIndex
CREATE UNIQUE INDEX "TraoDoiNhan_traoDoiId_userId_key" ON "TraoDoiNhan"("traoDoiId", "userId");

-- AddForeignKey
ALTER TABLE "TraoDoiNhan" ADD CONSTRAINT "TraoDoiNhan_traoDoiId_fkey" FOREIGN KEY ("traoDoiId") REFERENCES "TraoDoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
