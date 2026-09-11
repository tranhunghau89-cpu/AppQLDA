-- CRM: bảng khách đang chào giá, tách khỏi Customer (chủ đầu tư đã ký hợp đồng).
--
-- Vì sao là bảng RIÊNG: Customer cần MST, địa chỉ pháp lý, người đại diện — những thứ
-- mãi tới lúc lên hợp đồng mới có. Lúc mới gọi điện chỉ biết một người ở một công ty.
-- Ép khai đủ ngay từ cuộc gọi đầu là ép sai chỗ, và làm danh sách CĐT đầy những cái
-- tên chưa ký gì.
--
-- KhachHang.customerId được nối khi ký hợp đồng — tới CĐT mới tạo HOẶC một CĐT đã có.
-- Đó là chỗ chống một công ty bị nhập thành hai bản ghi không biết nhau.
--
-- CustomerNote.customerId nới thành NULL được: từ nay một ghi chép treo ở khách (CRM)
-- hoặc ở CĐT, đúng một trong hai. Nới NOT NULL là THÊM quyền, không mất dữ liệu —
-- mọi dòng đang có vẫn giữ nguyên customerId.
--
-- Toàn bộ migration này là THÊM MỚI hoặc NỚI LỎNG — không DROP, không mất dữ liệu —
-- nên chạy được trên cơ sở dữ liệu đang phục vụ, và chạy lại được.

-- AlterTable
ALTER TABLE "CustomerNote" ADD COLUMN IF NOT EXISTS "khachHangId" TEXT;
ALTER TABLE "CustomerNote" ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KhachHang" (
    "id" TEXT NOT NULL,
    "tenCty" TEXT NOT NULL,
    "nguoiLienHe" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "diaChi" TEXT,
    "nguon" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "customerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KhachHang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KhachHang_ownerId_idx" ON "KhachHang"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KhachHang_customerId_idx" ON "KhachHang"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerNote_khachHangId_contactDate_idx" ON "CustomerNote"("khachHangId", "contactDate");

-- AddForeignKey
ALTER TABLE "KhachHang" ADD CONSTRAINT "KhachHang_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_khachHangId_fkey" FOREIGN KEY ("khachHangId") REFERENCES "KhachHang"("id") ON DELETE CASCADE ON UPDATE CASCADE;
