-- Tiến độ căn cứ ngày HĐ có hiệu lực. Chỉ thêm cột cho phép NULL: planDate nhập tay cũ giữ nguyên.
ALTER TABLE "Contract" ADD COLUMN "effectiveDate" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "durationDays" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "overlapDays" INTEGER;
