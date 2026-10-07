-- Chi phí thực (mua hàng) trên dòng dự toán thi công, và khối lượng quyết toán trên
-- hạng mục hợp đồng. Chỉ THÊM cột nullable: dòng cũ nhận NULL = chưa có số thực/QT.
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "actualUnitPrice" DOUBLE PRECISION;
ALTER TABLE "ContractItem" ADD COLUMN IF NOT EXISTS "settleQty" DOUBLE PRECISION;
