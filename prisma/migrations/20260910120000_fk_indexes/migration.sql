-- Index cho các khóa ngoại bị thiếu.
--
-- PostgreSQL KHÔNG tự tạo index cho khóa ngoại (khác MySQL). Trước migration này
-- các bảng Contract, ContractItem, PurchaseOrder, PurchaseOrderItem, PoItemImage,
-- Quote, QuoteSection, QuoteItem, CostCategory, CostItem chỉ có mỗi khóa chính —
-- mọi truy vấn "lấy các dòng thuộc dự án X / đơn hàng Y" đều là quét toàn bảng.
--
-- Ở quy mô hiện tại (123 dự án, 516 dòng dự toán) quét bảng vẫn nhanh nên sẽ KHÔNG
-- thấy nhanh lên ngay. Mục đích là tránh vách hiệu năng khi dữ liệu lớn dần, và
-- ProjectMember(userId) thì được dùng ở MỌI request (lọc phạm vi dự án của Phase 21).
--
-- Tất cả đều IF NOT EXISTS nên chạy lại an toàn.

-- Lọc phạm vi dự án — chạy mỗi request
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- Danh sách & lọc dự án
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX IF NOT EXISTS "ProjectSupplier_supplierId_idx" ON "ProjectSupplier"("supplierId");

-- Hợp đồng
CREATE INDEX IF NOT EXISTS "Contract_projectId_idx" ON "Contract"("projectId");
CREATE INDEX IF NOT EXISTS "ContractItem_contractId_idx" ON "ContractItem"("contractId");

-- Đơn hàng / mua hàng
CREATE INDEX IF NOT EXISTS "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "PoItemImage_itemId_idx" ON "PoItemImage"("itemId");

-- Dự toán
CREATE INDEX IF NOT EXISTS "EstimateItem_projectId_idx" ON "EstimateItem"("projectId");
CREATE INDEX IF NOT EXISTS "EstimateItem_supplierId_idx" ON "EstimateItem"("supplierId");

-- Tổng hợp chi phí (quyết toán)
CREATE INDEX IF NOT EXISTS "CostCategory_summaryId_idx" ON "CostCategory"("summaryId");
CREATE INDEX IF NOT EXISTS "CostItem_categoryId_idx" ON "CostItem"("categoryId");

-- Báo giá chi tiết
CREATE INDEX IF NOT EXISTS "Quote_projectId_idx" ON "Quote"("projectId");
CREATE INDEX IF NOT EXISTS "QuoteSection_quoteId_idx" ON "QuoteSection"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteSection_parentId_idx" ON "QuoteSection"("parentId");
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
