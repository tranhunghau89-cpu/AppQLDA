-- Cơ hội: một công trình đang chào giá cho một khách, đứng TRƯỚC dự án.
--
-- Cố ý KHÔNG có mã duy nhất kiểu Project.code. Chào giá mười nơi trúng một thì chín mã
-- kia là rác, mà Project.code lại UNIQUE nên xóa đi mới dùng lại được.
--
-- Vì sao cần bảng này chứ không treo báo giá thẳng vào khách: phép suy đơn giá m² đọc
-- `area` làm mẫu số và `buildingType` để chọn sẵn mẫu báo giá. Không có chỗ giữ hai thứ
-- đó thì phép suy gãy.
--
-- projectId UNIQUE và ON DELETE SET NULL: một cơ hội sinh ra đúng một dự án; xóa dự án
-- thì cơ hội vẫn còn để tra lại đã từng chào cái gì.
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi bảng cũ — nên chạy được
-- trên cơ sở dữ liệu đang phục vụ, và chạy lại được.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CoHoi" (
    "id" TEXT NOT NULL,
    "khachHangId" TEXT NOT NULL,
    "tenCongTrinh" TEXT NOT NULL,
    "diaDiem" TEXT,
    "buildingType" TEXT,
    "area" DOUBLE PRECISION,
    "kK" DOUBLE PRECISION,
    "kL" DOUBLE PRECISION,
    "kH" DOUBLE PRECISION,
    "trangThai" TEXT NOT NULL DEFAULT 'MOI',
    "lyDoMat" TEXT,
    "projectId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoHoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CoHoi_projectId_key" ON "CoHoi"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoHoi_khachHangId_idx" ON "CoHoi"("khachHangId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoHoi_trangThai_idx" ON "CoHoi"("trangThai");

-- AddForeignKey
ALTER TABLE "CoHoi" ADD CONSTRAINT "CoHoi_khachHangId_fkey" FOREIGN KEY ("khachHangId") REFERENCES "KhachHang"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoHoi" ADD CONSTRAINT "CoHoi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
