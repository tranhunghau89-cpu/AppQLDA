-- Mỗi giai đoạn QC chia 3 nhóm mục: Việc cần làm (VIEC), Hồ sơ cần có (HO_SO), Kiểm tra QC (KIEM_TRA).
-- Mục cũ giữ nguyên là KIEM_TRA.
ALTER TABLE "QcMau" ADD COLUMN "nhom" TEXT NOT NULL DEFAULT 'KIEM_TRA';
ALTER TABLE "QcMuc" ADD COLUMN "nhom" TEXT NOT NULL DEFAULT 'KIEM_TRA';

-- Bộ việc / hồ sơ gợi ý. thuTu 101.. cho việc, 201.. cho hồ sơ để không lẫn với mục kiểm tra.
-- Chạy lại an toàn (bỏ qua id đã có).
INSERT INTO "QcMau" ("id", "giaiDoan", "nhom", "noiDung", "boPhan", "loai", "tieuChi", "thuTu", "active", "updatedAt") VALUES
  -- Hợp đồng & Dự toán
  ('qcv_hd_01', 'HD_DT', 'VIEC', '1. Khảo sát, chốt yêu cầu và phương án với CĐT', 'SALES', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_hd_02', 'HD_DT', 'VIEC', '2. Lập dự toán chi tiết theo phương án', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_hd_03', 'HD_DT', 'VIEC', '3. Soạn hợp đồng và phụ lục theo mẫu công ty', 'SALES', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_hd_04', 'HD_DT', 'VIEC', '4. Trình BGĐ duyệt giá và hợp đồng', 'SALES', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_hd_05', 'HD_DT', 'VIEC', '5. Gửi CĐT ký hợp đồng', 'SALES', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qcv_hd_06', 'HD_DT', 'VIEC', '6. Theo dõi nhận tạm ứng đợt 1', 'ACCOUNTING', 'THUONG', NULL, 106, true, CURRENT_TIMESTAMP),
  ('qch_hd_01', 'HD_DT', 'HO_SO', '1. Báo giá đã chốt với CĐT', 'SALES', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_hd_02', 'HD_DT', 'HO_SO', '2. Bảng dự toán chi tiết', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_hd_03', 'HD_DT', 'HO_SO', '3. Hợp đồng đã ký đủ hai bên (bản scan)', 'SALES', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_hd_04', 'HD_DT', 'HO_SO', '4. Phụ lục hợp đồng: phạm vi, quy cách vật tư, tiến độ thanh toán', 'SALES', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_hd_05', 'HD_DT', 'HO_SO', '5. Giấy tờ pháp lý CĐT: ĐKKD / CCCD người ký, giấy uỷ quyền (nếu có)', 'SALES', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP),
  ('qch_hd_06', 'HD_DT', 'HO_SO', '6. Chứng từ nhận tạm ứng đợt 1', 'ACCOUNTING', 'THUONG', NULL, 206, true, CURRENT_TIMESTAMP),

  -- Bản vẽ KT
  ('qcv_bv_01', 'BV_KT', 'VIEC', '1. Khảo sát, đo đạc hiện trạng mặt bằng', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_bv_02', 'BV_KT', 'VIEC', '2. Lập bộ bản vẽ kỹ thuật', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_bv_03', 'BV_KT', 'VIEC', '3. Kiểm tra nội bộ bản vẽ trước khi gửi', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_bv_04', 'BV_KT', 'VIEC', '4. Gửi CĐT duyệt, cập nhật theo ý kiến', 'SALES', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qch_bv_01', 'BV_KT', 'HO_SO', '1. Ảnh / biên bản khảo sát hiện trạng', 'ENGINEERING', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_bv_02', 'BV_KT', 'HO_SO', '2. Bộ bản vẽ kỹ thuật bản cuối (PDF)', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_bv_03', 'BV_KT', 'HO_SO', '3. Xác nhận duyệt bản vẽ của CĐT (chữ ký / email / Zalo)', 'SALES', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_bv_04', 'BV_KT', 'HO_SO', '4. Giấy phép xây dựng (nếu công trình cần)', 'SALES', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),

  -- Shop
  ('qcv_sh_01', 'SHOP', 'VIEC', '1. Triển khai shop drawing từ bản vẽ kỹ thuật', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_sh_02', 'SHOP', 'VIEC', '2. Lập bảng thống kê vật tư (BOQ) từ shop', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_sh_03', 'SHOP', 'VIEC', '3. Đối chiếu BOQ với dự toán, báo các dòng lệch', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_sh_04', 'SHOP', 'VIEC', '4. Gửi CĐT duyệt shop drawing', 'SALES', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qch_sh_01', 'SHOP', 'HO_SO', '1. Bộ shop drawing bản cuối (PDF)', 'ENGINEERING', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_sh_02', 'SHOP', 'HO_SO', '2. Bảng BOQ vật tư từ shop', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_sh_03', 'SHOP', 'HO_SO', '3. Xác nhận duyệt shop drawing của CĐT', 'SALES', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),

  -- Mua hàng
  ('qcv_mh_01', 'MUA_HANG', 'VIEC', '1. Lập đề xuất mua hàng theo BOQ shop', 'PROCUREMENT', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_mh_02', 'MUA_HANG', 'VIEC', '2. Lấy báo giá, chọn nhà cung cấp', 'PROCUREMENT', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_mh_03', 'MUA_HANG', 'VIEC', '3. Trình duyệt đơn hàng', 'PROCUREMENT', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_mh_04', 'MUA_HANG', 'VIEC', '4. Theo dõi giao hàng đúng hẹn', 'PROCUREMENT', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_mh_05', 'MUA_HANG', 'VIEC', '5. Thanh toán NCC theo điều khoản đơn hàng', 'ACCOUNTING', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qch_mh_01', 'MUA_HANG', 'HO_SO', '1. Báo giá NCC (vật tư chính có ít nhất 2 báo giá)', 'PROCUREMENT', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_mh_02', 'MUA_HANG', 'HO_SO', '2. Đơn đặt hàng đã duyệt', 'PROCUREMENT', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_mh_03', 'MUA_HANG', 'HO_SO', '3. Hợp đồng / xác nhận đặt hàng của NCC', 'PROCUREMENT', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_mh_04', 'MUA_HANG', 'HO_SO', '4. Phiếu giao hàng, biên bản nhận hàng', 'PROCUREMENT', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_mh_05', 'MUA_HANG', 'HO_SO', '5. Hoá đơn của NCC', 'ACCOUNTING', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP),

  -- Gia công
  ('qcv_gc_01', 'GIA_CONG', 'VIEC', '1. Lập kế hoạch gia công, giao việc cho xưởng', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_gc_02', 'GIA_CONG', 'VIEC', '2. Nhập kho, kiểm vật tư đầu vào', 'PROCUREMENT', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_gc_03', 'GIA_CONG', 'VIEC', '3. Cắt, khoan, hàn cấu kiện theo shop', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_gc_04', 'GIA_CONG', 'VIEC', '4. Làm sạch bề mặt và sơn', 'ENGINEERING', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_gc_05', 'GIA_CONG', 'VIEC', '5. Đánh mã cấu kiện, đóng gói, xuất xưởng', 'ENGINEERING', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qch_gc_01', 'GIA_CONG', 'HO_SO', '1. Phiếu nhập kho vật tư', 'PROCUREMENT', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_gc_02', 'GIA_CONG', 'HO_SO', '2. CO/CQ thép, tôn, bu lông, sơn', 'PROCUREMENT', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_gc_03', 'GIA_CONG', 'HO_SO', '3. Biên bản kiểm tra kích thước cấu kiện', 'ENGINEERING', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_gc_04', 'GIA_CONG', 'HO_SO', '4. Biên bản kiểm tra mối hàn và sơn', 'ENGINEERING', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_gc_05', 'GIA_CONG', 'HO_SO', '5. Phiếu xuất xưởng / danh sách cấu kiện giao', 'ENGINEERING', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP),

  -- Lắp dựng
  ('qcv_ld_01', 'LAP_DUNG', 'VIEC', '1. Nhận bàn giao mặt bằng, tim mốc, cao độ', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_ld_02', 'LAP_DUNG', 'VIEC', '2. Lập biện pháp thi công và an toàn', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_ld_03', 'LAP_DUNG', 'VIEC', '3. Bố trí cẩu, nhân lực, vận chuyển cấu kiện', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_ld_04', 'LAP_DUNG', 'VIEC', '4. Dựng khung, căn chỉnh, siết bu lông', 'ENGINEERING', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_ld_05', 'LAP_DUNG', 'VIEC', '5. Ghi nhật ký thi công hằng ngày', 'ENGINEERING', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qch_ld_01', 'LAP_DUNG', 'HO_SO', '1. Biên bản bàn giao mặt bằng', 'ENGINEERING', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_ld_02', 'LAP_DUNG', 'HO_SO', '2. Biện pháp thi công / an toàn đã duyệt', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_ld_03', 'LAP_DUNG', 'HO_SO', '3. Giấy kiểm định thiết bị nâng, chứng chỉ người vận hành', 'ENGINEERING', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_ld_04', 'LAP_DUNG', 'HO_SO', '4. Biên bản nghiệm thu lắp dựng khung', 'ENGINEERING', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_ld_05', 'LAP_DUNG', 'HO_SO', '5. Nhật ký thi công phần lắp dựng', 'ENGINEERING', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP),

  -- Lợp tôn
  ('qcv_lt_01', 'LOP_TON', 'VIEC', '1. Kiểm tôn, phụ kiện về công trình', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_lt_02', 'LOP_TON', 'VIEC', '2. Lợp mái, vách theo shop', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_lt_03', 'LOP_TON', 'VIEC', '3. Lắp diềm, úp nóc, máng xối, ống thoát', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_lt_04', 'LOP_TON', 'VIEC', '4. Thử nước, xử lý điểm dột', 'ENGINEERING', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_lt_05', 'LOP_TON', 'VIEC', '5. Vệ sinh mái, thu dọn công trường', 'ENGINEERING', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qch_lt_01', 'LOP_TON', 'HO_SO', '1. Phiếu giao tôn và phụ kiện', 'PROCUREMENT', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_lt_02', 'LOP_TON', 'HO_SO', '2. Biên bản nghiệm thu lợp tôn, phụ kiện', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_lt_03', 'LOP_TON', 'HO_SO', '3. Ảnh kiểm tra dột / thử nước', 'ENGINEERING', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),

  -- Hồ sơ nghiệm thu
  ('qcv_nt_01', 'HS_NT', 'VIEC', '1. Tập hợp biên bản nghiệm thu các giai đoạn', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_nt_02', 'HS_NT', 'VIEC', '2. Lập bản vẽ hoàn công', 'ENGINEERING', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_nt_03', 'HS_NT', 'VIEC', '3. Tổ chức nghiệm thu hoàn thành với CĐT', 'ENGINEERING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_nt_04', 'HS_NT', 'VIEC', '4. Bàn giao công trình, hướng dẫn sử dụng và bảo hành', 'SALES', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qch_nt_01', 'HS_NT', 'HO_SO', '1. Biên bản nghiệm thu hoàn thành, bàn giao đưa vào sử dụng', 'ENGINEERING', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_nt_02', 'HS_NT', 'HO_SO', '2. Bản vẽ hoàn công có xác nhận', 'ENGINEERING', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_nt_03', 'HS_NT', 'HO_SO', '3. Bộ CO/CQ vật tư chính', 'PROCUREMENT', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_nt_04', 'HS_NT', 'HO_SO', '4. Nhật ký thi công đầy đủ', 'ENGINEERING', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_nt_05', 'HS_NT', 'HO_SO', '5. Phiếu bảo hành công trình', 'SALES', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP),

  -- Hồ sơ quyết toán
  ('qcv_qt_01', 'HS_QT', 'VIEC', '1. Lập hồ sơ quyết toán khối lượng', 'ENGINEERING', 'THUONG', NULL, 101, true, CURRENT_TIMESTAMP),
  ('qcv_qt_02', 'HS_QT', 'VIEC', '2. Chốt phát sinh tăng / giảm với CĐT', 'SALES', 'THUONG', NULL, 102, true, CURRENT_TIMESTAMP),
  ('qcv_qt_03', 'HS_QT', 'VIEC', '3. Xuất hoá đơn các đợt còn lại', 'ACCOUNTING', 'THUONG', NULL, 103, true, CURRENT_TIMESTAMP),
  ('qcv_qt_04', 'HS_QT', 'VIEC', '4. Đối chiếu công nợ, thu tiền còn lại', 'ACCOUNTING', 'THUONG', NULL, 104, true, CURRENT_TIMESTAMP),
  ('qcv_qt_05', 'HS_QT', 'VIEC', '5. Thanh lý hợp đồng, đóng hồ sơ dự án', 'ADMIN', 'THUONG', NULL, 105, true, CURRENT_TIMESTAMP),
  ('qch_qt_01', 'HS_QT', 'HO_SO', '1. Bảng quyết toán khối lượng có xác nhận của CĐT', 'ENGINEERING', 'THUONG', NULL, 201, true, CURRENT_TIMESTAMP),
  ('qch_qt_02', 'HS_QT', 'HO_SO', '2. Biên bản phát sinh tăng / giảm (nếu có)', 'SALES', 'THUONG', NULL, 202, true, CURRENT_TIMESTAMP),
  ('qch_qt_03', 'HS_QT', 'HO_SO', '3. Hoá đơn GTGT các đợt', 'ACCOUNTING', 'THUONG', NULL, 203, true, CURRENT_TIMESTAMP),
  ('qch_qt_04', 'HS_QT', 'HO_SO', '4. Biên bản đối chiếu công nợ đã ký', 'ACCOUNTING', 'THUONG', NULL, 204, true, CURRENT_TIMESTAMP),
  ('qch_qt_05', 'HS_QT', 'HO_SO', '5. Biên bản thanh lý hợp đồng', 'SALES', 'THUONG', NULL, 205, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
