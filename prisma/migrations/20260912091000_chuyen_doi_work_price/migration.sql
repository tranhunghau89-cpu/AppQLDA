-- Chuyển 135 dòng WorkPrice sang thư viện mới. CHỈ THÊM DỮ LIỆU — không đụng tới
-- WorkPrice, không đụng tới bất kỳ bảng nào khác. WorkPrice ở lại nguyên vẹn để còn
-- đối soát; nó chỉ bị xóa ở một release riêng sau khi đã dùng thư viện mới đủ lâu.
--
-- GIỮ NGUYÊN id và mã:
--   CongTac.id = WorkPrice.id  và  CongTac.ma = WorkPrice.code
-- QuoteItem.workCode trỏ vào danh mục bằng CHUỖI MÃ (tham chiếu mềm), nên giữ mã
-- nguyên văn làm 72 dòng báo giá đang có tự khớp catalog mới mà không phải sửa một
-- byte dữ liệu nào. Dùng lại id còn làm câu INSERT này chạy lại được miễn phí.

INSERT INTO "CongTac" (
    "id", "ma", "ten", "tenNgan", "quyCach", "donVi",
    "nhomMa", "nhomChiPhi", "heSo", "ghiChu", "sortOrder",
    "active", "createdAt", "updatedAt"
)
SELECT
    w."id",
    w."code",
    w."name",
    w."shortName",
    w."spec",
    w."unit",
    w."groupCode",
    -- Ánh xạ nhóm mã công việc -> nhóm chi phí mua hàng. Đây là GIÁ TRỊ KHỞI TẠO;
    -- quản trị viên sửa lại trên từng công tác được. Bản sao của bảng này nằm ở
    -- src/lib/constants.ts (NHOM_MA_SANG_NHOM_CHI_PHI) cho phần nhập liệu về sau.
    CASE w."groupCode"
        WHEN 'AA' THEN 'KCT'
        WHEN 'AB' THEN 'BL_NEO'
        WHEN 'AC' THEN 'BLLK'
        WHEN 'AD' THEN 'TON'
        WHEN 'AE' THEN 'VT_PHU'
        WHEN 'AF' THEN 'TON'
        WHEN 'AG' THEN 'VAN_CHUYEN'
        WHEN 'AK' THEN 'NHAN_CONG'
        ELSE 'KHAC'
    END,
    w."coefficient",
    w."note",
    w."sortOrder",
    true,
    w."createdAt",
    w."updatedAt"
FROM "WorkPrice" w
ON CONFLICT ("id") DO NOTHING;

-- Mỗi công tác nhận một bản giá đầu tiên: giá chung toàn quốc, mọi biến thể.
--
-- hieuLucTu là NGÀY HẰNG SỐ chứ không phải NOW(). Migration phải sinh ra cùng một
-- kết quả trên máy lập trình, môi trường thử và môi trường thật, bất kể chạy ngày
-- nào — với NOW() thì câu hỏi "ngày 15/01 đơn giá bao nhiêu" trả lời khác nhau theo
-- từng nơi. Chọn 2020-01-01 vì nó sớm hơn mọi báo giá đang có, nên tra giá theo
-- ngày của một báo giá cũ vẫn tìm thấy bản giá này.
INSERT INTO "DonGiaCongTac" (
    "id", "congTacId", "congTacVatTuId", "khuVucId",
    "vatTu", "nhanCongMay", "heSo", "donGia",
    "hieuLucTu", "nguon", "ghiChu", "createdAt"
)
SELECT
    'dg_' || w."id",
    w."id",
    NULL,
    NULL,
    w."material",
    w."laborMachine",
    w."coefficient",
    COALESCE(w."baseCost", 0),
    TIMESTAMP '2020-01-01 00:00:00',
    'CHUYEN_DOI',
    'Chuyển từ bảng đơn giá cũ (WorkPrice)',
    w."createdAt"
FROM "WorkPrice" w
ON CONFLICT ("id") DO NOTHING;
