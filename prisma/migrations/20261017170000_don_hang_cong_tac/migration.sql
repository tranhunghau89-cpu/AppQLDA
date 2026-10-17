-- Món đơn hàng trỏ về công tác thư viện đơn giá — nguồn chung với dự toán thi công.
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "congTacId" TEXT;
CREATE INDEX "PurchaseOrderItem_congTacId_idx" ON "PurchaseOrderItem"("congTacId");
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_congTacId_fkey" FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
