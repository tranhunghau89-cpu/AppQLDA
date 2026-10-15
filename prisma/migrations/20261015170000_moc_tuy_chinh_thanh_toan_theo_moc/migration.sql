-- Mốc tiến độ sửa tên/thứ tự/xóa được; đợt thanh toán gắn hạn theo mốc. Chỉ thêm cột.
ALTER TABLE "Milestone" ADD COLUMN "name" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "milestoneType" TEXT;
ALTER TABLE "Payment" ADD COLUMN "offsetDays" INTEGER;
