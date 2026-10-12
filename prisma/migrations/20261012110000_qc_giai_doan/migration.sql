CREATE TABLE "QcMau" (
    "id" TEXT NOT NULL,
    "giaiDoan" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "boPhan" TEXT NOT NULL,
    "loai" TEXT NOT NULL DEFAULT 'THUONG',
    "thuTu" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcMau_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QcMau_giaiDoan_thuTu_idx" ON "QcMau"("giaiDoan", "thuTu");

CREATE TABLE "QcMuc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "giaiDoan" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "boPhan" TEXT NOT NULL,
    "loai" TEXT NOT NULL DEFAULT 'THUONG',
    "thuTu" INTEGER NOT NULL DEFAULT 0,
    "ketQua" TEXT NOT NULL DEFAULT 'CHUA',
    "nguoiKiem" TEXT,
    "ngayKiem" TIMESTAMP(3),
    "ghiChu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QcMuc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QcMuc_projectId_giaiDoan_idx" ON "QcMuc"("projectId", "giaiDoan");
CREATE INDEX "QcMuc_boPhan_ketQua_idx" ON "QcMuc"("boPhan", "ketQua");
ALTER TABLE "QcMuc" ADD CONSTRAINT "QcMuc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QcLanKiem" (
    "id" TEXT NOT NULL,
    "mucId" TEXT NOT NULL,
    "ketQua" TEXT NOT NULL,
    "ghiChu" TEXT,
    "nguoiId" TEXT NOT NULL,
    "nguoiTen" TEXT NOT NULL,
    "nguoiVai" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QcLanKiem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QcLanKiem_mucId_createdAt_idx" ON "QcLanKiem"("mucId", "createdAt");
ALTER TABLE "QcLanKiem" ADD CONSTRAINT "QcLanKiem_mucId_fkey" FOREIGN KEY ("mucId") REFERENCES "QcMuc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QcTep" (
    "id" TEXT NOT NULL,
    "lanKiemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QcTep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QcTep_lanKiemId_idx" ON "QcTep"("lanKiemId");
ALTER TABLE "QcTep" ADD CONSTRAINT "QcTep_lanKiemId_fkey" FOREIGN KEY ("lanKiemId") REFERENCES "QcLanKiem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bộ mẫu gợi ý (plan/11_QcGiaiDoan_design.md). id cố định để chạy lại không trùng.
INSERT INTO "QcMau" ("id", "giaiDoan", "noiDung", "boPhan", "loai", "thuTu", "active", "updatedAt") VALUES
  ('qcmau_01', 'BV_KT', 'Hồ sơ thiết kế đủ: mặt bằng, mặt đứng, mặt cắt, kết cấu móng, khung', 'ENGINEERING', 'THUONG', 1, true, CURRENT_TIMESTAMP),
  ('qcmau_02', 'BV_KT', 'Kích thước K × L × H và diện tích khớp hợp đồng', 'ENGINEERING', 'THUONG', 2, true, CURRENT_TIMESTAMP),
  ('qcmau_03', 'BV_KT', 'Tải trọng, vùng gió, tiêu chuẩn thiết kế ghi rõ trên bản vẽ', 'ENGINEERING', 'THUONG', 3, true, CURRENT_TIMESTAMP),
  ('qcmau_04', 'BV_KT', 'Bản vẽ kỹ thuật đã gửi CĐT và có xác nhận', 'SALES', 'THUONG', 4, true, CURRENT_TIMESTAMP),
  ('qcmau_05', 'SHOP', 'Shop drawing đúng thông tin HĐ: khẩu độ, bước khung, cao độ, độ dốc mái', 'ENGINEERING', 'THUONG', 5, true, CURRENT_TIMESTAMP),
  ('qcmau_06', 'SHOP', 'Chủng loại thép, tôn, xà gồ trên shop đúng chủng loại HĐ', 'ENGINEERING', 'DOI_CHIEU_VAT_TU', 6, true, CURRENT_TIMESTAMP),
  ('qcmau_07', 'SHOP', 'Bảng thống kê vật tư (BOQ) từ shop khớp dự toán', 'ENGINEERING', 'THUONG', 7, true, CURRENT_TIMESTAMP),
  ('qcmau_08', 'SHOP', 'CĐT đã duyệt shop drawing (có biên bản / email xác nhận)', 'SALES', 'THUONG', 8, true, CURRENT_TIMESTAMP),
  ('qcmau_09', 'MUA_HANG', 'Vật liệu trong đơn hàng đúng chủng loại theo HĐ', 'PROCUREMENT', 'DOI_CHIEU_VAT_TU', 9, true, CURRENT_TIMESTAMP),
  ('qcmau_10', 'MUA_HANG', 'Màu tôn, màu sơn trong đơn hàng đúng HĐ', 'PROCUREMENT', 'DOI_CHIEU_VAT_TU', 10, true, CURRENT_TIMESTAMP),
  ('qcmau_11', 'MUA_HANG', 'Khối lượng đặt hàng khớp BOQ shop (sai lệch hợp lý)', 'PROCUREMENT', 'THUONG', 11, true, CURRENT_TIMESTAMP),
  ('qcmau_12', 'MUA_HANG', 'Đơn giá / NCC đã được duyệt', 'ADMIN', 'THUONG', 12, true, CURRENT_TIMESTAMP),
  ('qcmau_13', 'GIA_CONG', 'Vật tư nhập kho đúng quy cách, có CO/CQ', 'PROCUREMENT', 'THUONG', 13, true, CURRENT_TIMESTAMP),
  ('qcmau_14', 'GIA_CONG', 'Kích thước cấu kiện đúng shop drawing (kiểm xác suất)', 'ENGINEERING', 'THUONG', 14, true, CURRENT_TIMESTAMP),
  ('qcmau_15', 'GIA_CONG', 'Mối hàn đạt yêu cầu (chiều cao, không rỗ, không nứt)', 'ENGINEERING', 'THUONG', 15, true, CURRENT_TIMESTAMP),
  ('qcmau_16', 'GIA_CONG', 'Sơn đúng màu, đủ số lớp và độ dày', 'ENGINEERING', 'THUONG', 16, true, CURRENT_TIMESTAMP),
  ('qcmau_17', 'LAP_DUNG', 'Biên bản bàn giao mặt bằng, tim mốc, cao độ móng', 'ENGINEERING', 'THUONG', 17, true, CURRENT_TIMESTAMP),
  ('qcmau_18', 'LAP_DUNG', 'Kế hoạch an toàn lao động, thiết bị nâng có kiểm định', 'ENGINEERING', 'THUONG', 18, true, CURRENT_TIMESTAMP),
  ('qcmau_19', 'LAP_DUNG', 'Độ thẳng đứng cột, độ võng kèo trong dung sai', 'ENGINEERING', 'THUONG', 19, true, CURRENT_TIMESTAMP),
  ('qcmau_20', 'LAP_DUNG', 'Bu lông liên kết đủ số lượng, siết đúng lực', 'ENGINEERING', 'THUONG', 20, true, CURRENT_TIMESTAMP),
  ('qcmau_21', 'LOP_TON', 'Tôn đúng loại, độ dày, màu theo HĐ', 'ENGINEERING', 'DOI_CHIEU_VAT_TU', 21, true, CURRENT_TIMESTAMP),
  ('qcmau_22', 'LOP_TON', 'Vít, diềm, máng xối, phụ kiện lắp đủ và đúng vị trí', 'ENGINEERING', 'THUONG', 22, true, CURRENT_TIMESTAMP),
  ('qcmau_23', 'LOP_TON', 'Kiểm tra dột / thấm sau lợp', 'ENGINEERING', 'THUONG', 23, true, CURRENT_TIMESTAMP),
  ('qcmau_24', 'HS_NT', 'Đủ biên bản nghiệm thu từng giai đoạn', 'ENGINEERING', 'THUONG', 24, true, CURRENT_TIMESTAMP),
  ('qcmau_25', 'HS_NT', 'Nhật ký thi công đầy đủ', 'ENGINEERING', 'THUONG', 25, true, CURRENT_TIMESTAMP),
  ('qcmau_26', 'HS_NT', 'Bản vẽ hoàn công', 'ENGINEERING', 'THUONG', 26, true, CURRENT_TIMESTAMP),
  ('qcmau_27', 'HS_NT', 'CO/CQ vật tư chính đầy đủ trong hồ sơ', 'PROCUREMENT', 'THUONG', 27, true, CURRENT_TIMESTAMP),
  ('qcmau_28', 'HS_QT', 'Bảng khối lượng quyết toán khớp hoàn công', 'ENGINEERING', 'THUONG', 28, true, CURRENT_TIMESTAMP),
  ('qcmau_29', 'HS_QT', 'Hồ sơ thanh toán các đợt đầy đủ', 'ACCOUNTING', 'THUONG', 29, true, CURRENT_TIMESTAMP),
  ('qcmau_30', 'HS_QT', 'Đối chiếu công nợ với CĐT đã ký', 'ACCOUNTING', 'THUONG', 30, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
