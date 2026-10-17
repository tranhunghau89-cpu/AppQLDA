-- Chiều dài một cây/tấm/sợi (mm) của món đơn hàng: tính kg, tổng dài, m² theo nhóm.
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "length" DOUBLE PRECISION;
