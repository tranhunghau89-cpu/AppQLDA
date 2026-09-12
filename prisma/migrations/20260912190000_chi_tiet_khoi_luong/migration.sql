-- Bảng bóc khối lượng chi tiết cho từng đầu mục dự toán thi công, và khoá nối từ dòng
-- đơn hàng về đầu mục ấy.
--
-- ⚠ PHÉP KIỂM TRƯỚC DEPLOY SẼ BÁO ĐỘNG Ở MIGRATION NÀY, VÀ ĐÓ LÀ ĐÚNG.
--
-- Phép kiểm là: grep tên bảng dự toán thi công trong migration. Ở đây tên đó xuất hiện
-- HAI lần, cả hai đều trong mệnh đề REFERENCES của khoá ngoại — một khoá ngoại buộc
-- phải gọi tên bảng đích, không có cách viết nào tránh được. Người kiểm hãy xác nhận
-- đúng hai dòng đó và không có gì khác:
--
--   grep -nE 'ALTER TABLE "EstimateItem"|UPDATE "EstimateItem"|DELETE FROM "EstimateItem"' migration.sql
--   -> phải KHÔNG ra gì.
--
-- 516 dòng dự toán thi công trên bản thật không bị đọc, sửa hay khoá ghi bởi migration
-- này. Nó chỉ TẠO một bảng mới và THÊM một cột nullable trên bảng đơn hàng.

CREATE TABLE "ChiTietKhoiLuong" (
    "id" TEXT NOT NULL,
    "estimateItemId" TEXT NOT NULL,
    -- Nhóm hiển thị: "TRỤC X1" của bảng tôn, hoặc tên cấu kiện của bảng kết cấu.
    "nhom" TEXT,
    "maSo" TEXT,
    "quyCach" TEXT,
    "tenCauKien" TEXT,
    "soLuong" DOUBLE PRECISION,
    "dai" DOUBLE PRECISION,
    "klDon" DOUBLE PRECISION,
    "dienTichDon" DOUBLE PRECISION,
    "vatTu" TEXT,
    "ghiChu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChiTietKhoiLuong_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChiTietKhoiLuong_estimateItemId_sortOrder_idx" ON "ChiTietKhoiLuong"("estimateItemId", "sortOrder");

-- Xoá đầu mục thì bảng bóc của nó đi theo: một bảng bóc không còn đầu mục nào là rác
-- không ai tìm thấy để dọn.
ALTER TABLE "ChiTietKhoiLuong" ADD CONSTRAINT "ChiTietKhoiLuong_estimateItemId_fkey"
    FOREIGN KEY ("estimateItemId") REFERENCES "EstimateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Món này đặt cho đầu mục nào. Nullable, không DEFAULT: mọi đơn hàng đã nhập từ Excel
-- đều chưa nối, và nối là việc làm dần chứ không bắt buộc.
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "estimateItemId" TEXT;
CREATE INDEX "PurchaseOrderItem_estimateItemId_idx" ON "PurchaseOrderItem"("estimateItemId");

-- SET NULL chứ không CASCADE: xoá một đầu mục dự toán không được phép làm biến mất một
-- dòng đơn hàng đã đặt thật với nhà cung cấp.
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_estimateItemId_fkey"
    FOREIGN KEY ("estimateItemId") REFERENCES "EstimateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
