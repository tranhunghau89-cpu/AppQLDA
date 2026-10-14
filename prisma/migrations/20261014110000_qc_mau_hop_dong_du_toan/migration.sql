-- Giai đoạn QC mới "Hợp đồng & Dự toán" (HD_DT) — đứng trước Bản vẽ KT, không gắn mốc tiến độ.
-- Bộ mục mẫu gợi ý; chạy lại an toàn (bỏ qua id đã có).
INSERT INTO "QcMau" ("id", "giaiDoan", "noiDung", "boPhan", "loai", "tieuChi", "thuTu", "active", "updatedAt") VALUES
  ('qcmau_hd_01', 'HD_DT', '1. Thông tin pháp lý các bên trong hợp đồng đầy đủ, chính xác', 'SALES', 'THUONG',
   E'Tên, địa chỉ, mã số thuế, người đại diện, chức vụ của CĐT đúng giấy ĐKKD / CCCD\nThông tin bên ta đúng: tên công ty, MST, số tài khoản ngân hàng\nNgười ký có thẩm quyền (có giấy uỷ quyền nếu không phải đại diện pháp luật)\nĐịa chỉ công trình ghi rõ, khớp hiện trạng',
   1, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_02', 'HD_DT', '2. Phạm vi công việc, hạng mục, quy mô khớp báo giá đã chốt', 'SALES', 'THUONG',
   E'Danh mục hạng mục trong HĐ / phụ lục trùng báo giá CĐT đã chấp nhận\nKích thước K × L × H, khẩu độ, diện tích ghi rõ\nGhi rõ hạng mục KHÔNG bao gồm (móng, điện, nước, PCCC… nếu không làm)\nTrách nhiệm mỗi bên về mặt bằng, điện nước thi công, giấy phép xây dựng',
   2, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_03', 'HD_DT', '3. Quy cách vật tư trong hợp đồng rõ ràng, đo kiểm được', 'ENGINEERING', 'THUONG',
   E'Thép kết cấu: mác thép, tiết diện / độ dày chính\nTôn: loại sóng, độ dày, lớp mạ, màu, thương hiệu\nXà gồ, bu lông, hệ sơn (số lớp, màu) ghi rõ\nKhông ghi chung chung "loại tốt", "tương đương" khi chưa có tiêu chí đo được\nQuy cách vật tư đã nhập vào app để đối chiếu ở các giai đoạn sau',
   3, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_04', 'HD_DT', '4. Dự toán đủ hạng mục, khối lượng có bảng tính từ phương án / bản vẽ', 'ENGINEERING', 'THUONG',
   E'Đủ nhóm chi phí: vật tư, gia công, vận chuyển, lắp dựng, máy, chi phí chung\nKhối lượng thép, tôn, xà gồ tính từ phương án / bản vẽ sơ bộ, có bảng tính kèm theo\nĐơn giá vật tư theo thư viện đơn giá / báo giá NCC còn hiệu lực\nĐã tính hao hụt, phụ kiện và dự phòng phát sinh',
   4, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_05', 'HD_DT', '5. Giá hợp đồng khớp dự toán, lợi nhuận đạt mức được duyệt', 'ADMIN', 'THUONG',
   E'Giá trị HĐ đúng báo giá đã chốt, ghi rõ trước / sau VAT\nLợi nhuận dự kiến (giá HĐ − dự toán) không thấp hơn mức BGĐ quy định\nChiết khấu / giảm giá (nếu có) đã được BGĐ duyệt\nGhi rõ giá trọn gói hay quyết toán theo khối lượng thực tế',
   5, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_06', 'HD_DT', '6. Tiến độ, thanh toán, bảo hành, phạt rõ ràng và khả thi', 'SALES', 'THUONG',
   E'Thời gian thi công khớp năng lực xưởng và thời gian mua vật tư\nCác đợt thanh toán, tỷ lệ tạm ứng, điều kiện từng đợt ghi rõ\nThời hạn và phạm vi bảo hành (kết cấu, dột) ghi rõ\nPhạt chậm tiến độ / chậm thanh toán áp dụng hai chiều, có mức trần hợp lý\nCó điều khoản phát sinh, tạm dừng, chấm dứt hợp đồng',
   6, true, CURRENT_TIMESTAMP),
  ('qcmau_hd_07', 'HD_DT', '7. Hợp đồng đã được BGĐ duyệt, hai bên ký đủ và lưu trên app', 'SALES', 'THUONG',
   E'BGĐ duyệt bản HĐ cuối trước khi gửi CĐT ký\nĐủ chữ ký, đóng dấu hai bên; ký nháy từng trang và phụ lục\nBản scan HĐ đã ký lưu lên app (đính kèm làm bằng chứng)\nGiá trị HĐ, ngày ký, các đợt thanh toán đã nhập đúng trên app',
   7, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
