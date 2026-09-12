-- Chuyển hai bảng mẫu cũ sang bộ hạng mục. CHỈ THÊM DỮ LIỆU — không đụng
-- QuoteTemplate*, EstimateTemplate*, và tuyệt đối không đụng EstimateItem.
--
-- Phép gộp ở đây là CƠ HỌC chứ không phải phỏng đoán: hai dòng QuoteTemplateLine có
-- `sourceSectionCode` = 'A' và 'B', đúng bằng `code` của hai mẫu dự toán "Khung mái"
-- và "Vách". Cột đó sinh ra chính để nối hai mặt với nhau; từ nay chúng là MỘT phần
-- có hai mặt, thay vì hai bản ghi trỏ nhau bằng chuỗi.
--
-- Năm mẫu dự toán A–E là năm PHẦN của một nhà xưởng, không phải năm loại công trình,
-- nên chúng vào chung một bộ.
--
-- Mọi id sinh ra đều TẤT ĐỊNH (giữ nguyên id cũ, hoặc băm md5 từ nội dung) nên chạy
-- lại migration này không sinh bản sao.

-- ---------- 1. QuoteTemplate -> BoHangMuc ----------
--
-- GIỮ NGUYÊN id: `ClientQuote.templateId` là tham chiếu mềm (không khóa ngoại) tới
-- mẫu báo giá; đổi id là làm treo mọi báo giá đã phát hành.
--
-- `ma` băm từ id vì không thể sinh mã đọc được từ tên tiếng Việt trong SQL. Đây là
-- mã tạm, quản trị viên đổi lại trên giao diện.
INSERT INTO "BoHangMuc" (
    "id", "ma", "ten", "loaiCongTrinh", "moTa", "active", "sortOrder",
    "vatPercent", "validDays", "warrantyMonths", "maintenanceMonths",
    "loadRoof", "loadHanging", "loadFloor",
    "lineDetail", "greeting", "closing", "colorNote", "volumeNote", "excludeNote",
    "createdAt", "updatedAt"
)
SELECT
    t."id",
    'BHM-' || upper(substring(md5(t."id") from 1 for 6)),
    t."name",
    t."buildingType",
    t."description",
    t."active",
    t."sortOrder",
    t."vatPercent", t."validDays", t."warrantyMonths", t."maintenanceMonths",
    t."loadRoof", t."loadHanging", t."loadFloor",
    t."lineDetail", t."greeting", t."closing", t."colorNote", t."volumeNote", t."excludeNote",
    t."createdAt", t."updatedAt"
FROM "QuoteTemplate" t
ON CONFLICT ("id") DO NOTHING;

-- ---------- 2. QuoteTemplateSpec -> VatTu ----------
--
-- 32 dòng TSKT của hai mẫu phần lớn trùng nhau (cùng bộ mặc định). Băm id từ
-- (tên + quy cách) nên hai dòng giống nhau cho ra CÙNG một vật tư — gộp trùng miễn
-- phí, và chạy lại không sinh thêm.
INSERT INTO "VatTu" (
    "id", "ma", "ten", "quyCach", "xuatXu", "nhomTSKT", "tag", "inTrongMoTa",
    "nhomChiPhi", "sortOrder", "active", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (khoa)
    'vt' || khoa,
    'TSKT-' || upper(substring(khoa from 1 for 8)),
    s."name",
    s."spec",
    s."origin",
    s."groupCode",
    s."tag",
    s."inDescription",
    'KHAC',
    s."sortOrder",
    true,
    NOW(),
    NOW()
FROM (
    SELECT
        sp.*,
        substring(md5(lower(trim(sp."name")) || '|' || lower(trim(coalesce(sp."spec", '')))) from 1 for 22) AS khoa
    FROM "QuoteTemplateSpec" sp
) s
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "BoHangMucVatTu" ("id", "boHangMucId", "vatTuId", "sortOrder")
SELECT DISTINCT ON (s."templateId", khoa)
    'bvt' || substring(md5(s."templateId" || '|' || khoa) from 1 for 22),
    s."templateId",
    'vt' || khoa,
    s."sortOrder"
FROM (
    SELECT
        sp.*,
        substring(md5(lower(trim(sp."name")) || '|' || lower(trim(coalesce(sp."spec", '')))) from 1 for 22) AS khoa
    FROM "QuoteTemplateSpec" sp
) s
WHERE EXISTS (SELECT 1 FROM "BoHangMuc" b WHERE b."id" = s."templateId")
ON CONFLICT ("id") DO NOTHING;

-- ---------- 3. Giai đoạn & thanh toán ----------
INSERT INTO "BoHangMucGiaiDoan" ("id", "boHangMucId", "ten", "soNgay", "sortOrder")
SELECT g."id", g."templateId", g."name", g."days", g."sortOrder"
FROM "QuoteTemplateStage" g
WHERE EXISTS (SELECT 1 FROM "BoHangMuc" b WHERE b."id" = g."templateId")
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "BoHangMucThanhToan" ("id", "boHangMucId", "nhan", "phanTram", "canCu", "ghiChu", "sortOrder")
SELECT t."id", t."templateId", t."label", t."percent", t."basis", t."note", t."sortOrder"
FROM "QuoteTemplatePayment" t
WHERE EXISTS (SELECT 1 FROM "BoHangMuc" b WHERE b."id" = t."templateId")
ON CONFLICT ("id") DO NOTHING;

-- ---------- 4. Bộ nhận 5 phần dự toán ----------
--
-- Bình thường là chính bộ vừa chuyển từ mẫu báo giá có khai loại công trình. Chỉ khi
-- không có bộ nào như vậy (cơ sở dữ liệu trắng) mới dựng một bộ dự phòng, để 90 dòng
-- công tác không mất chỗ bám.
INSERT INTO "BoHangMuc" ("id", "ma", "ten", "loaiCongTrinh", "moTa", "createdAt", "updatedAt")
SELECT
    'bhm_nha_xuong_khung_thep', 'NHA-XUONG', 'Nhà xưởng khung thép', 'Nhà xưởng',
    'Dựng tự động khi chuyển 5 mẫu dự toán cũ', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "BoHangMuc" WHERE "loaiCongTrinh" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;

-- ---------- 5. EstimateTemplate -> BoHangMucPhan ----------
--
-- Giữ nguyên id để `EstimateSection.templateId` (tham chiếu mềm) còn tra được.
-- `inChoKhach` để false trước; bước 7 bật lại cho những phần có mặt gửi khách.
INSERT INTO "BoHangMucPhan" (
    "id", "boHangMucId", "ma", "ten", "loai", "sortOrder", "inChoKhach", "tags"
)
SELECT
    e."id",
    (SELECT b."id" FROM "BoHangMuc" b WHERE b."loaiCongTrinh" IS NOT NULL
     ORDER BY b."sortOrder", b."id" LIMIT 1),
    COALESCE(NULLIF(trim(e."code"), ''), 'P' || e."sortOrder"),
    e."name",
    'PHAN',
    e."sortOrder",
    false,
    ARRAY[]::TEXT[]
FROM "EstimateTemplate" e
WHERE EXISTS (SELECT 1 FROM "BoHangMuc" b WHERE b."loaiCongTrinh" IS NOT NULL)
ON CONFLICT ("id") DO NOTHING;

-- ---------- 6. EstimateTemplateLine -> BoHangMucDong ----------
--
-- `congTacId` để trống: tên dòng là chữ tự do, không có cách khớp tự động nào an
-- toàn với 135 mã công tác. Quản trị viên gắn dần trên giao diện.
INSERT INTO "BoHangMucDong" (
    "id", "boHangMucId", "phanId", "ten", "donVi", "donGiaMacDinh", "khoiLuongMacDinh",
    "groupLabel", "nhomChiPhi", "ghiChu", "sortOrder",
    "vaiTro", "napThamSo", "layTuThamSo", "heSoQuyDoi"
)
SELECT
    l."id",
    p."boHangMucId",
    l."templateId",
    l."name",
    l."unit",
    l."defaultUnitPrice",
    l."defaultQty",
    l."groupLabel",
    l."groupCode",
    l."note",
    l."sortOrder",
    l."role",
    l."feedsParam",
    l."takesFromParam",
    l."factor"
FROM "EstimateTemplateLine" l
JOIN "BoHangMucPhan" p ON p."id" = l."templateId"
ON CONFLICT ("id") DO NOTHING;

-- ---------- 7. Nối mặt gửi khách vào đúng phần ----------
--
-- Đây là phép gộp thật sự: QuoteTemplateLine.sourceSectionCode = 'A' gặp
-- BoHangMucPhan.ma = 'A'. Từ nay một phần mang cả hai mặt.
UPDATE "BoHangMucPhan" p
SET "inChoKhach"    = true,
    "partCode"      = q."partCode",
    "partName"      = q."partName",
    "maKhach"       = q."code",
    "tenKhachHang"  = q."name",
    "moTaKhachHang" = q."detail",
    "donViKhach"    = q."unit",
    "donGiaKhach"   = q."defaultUnitPrice",
    "ghiChuKhach"   = q."note",
    "tags"          = q."tags",
    "steelFrameKey" = q."steelFrameKey"
FROM "QuoteTemplateLine" q
WHERE trim(q."sourceSectionCode") = p."ma"
  AND q."templateId" = p."boHangMucId";

-- ---------- 8. Dòng gửi khách không khớp phần nào -> phần riêng ----------
--
-- Không xảy ra với dữ liệu hiện tại (cả hai dòng đều khớp A và B), nhưng một mẫu
-- soạn sau có thể có dòng chưa gắn `sourceSectionCode`. Bỏ qua thì mất dòng đó.
INSERT INTO "BoHangMucPhan" (
    "id", "boHangMucId", "ma", "ten", "loai", "sortOrder", "inChoKhach",
    "partCode", "partName", "maKhach", "tenKhachHang", "moTaKhachHang",
    "donViKhach", "donGiaKhach", "ghiChuKhach", "tags", "steelFrameKey"
)
SELECT
    q."id",
    q."templateId",
    COALESCE(NULLIF(trim(q."code"), ''), 'K' || q."sortOrder"),
    q."name",
    'PHAN',
    100 + q."sortOrder",
    true,
    q."partCode", q."partName", q."code", q."name", q."detail",
    q."unit", q."defaultUnitPrice", q."note", q."tags", q."steelFrameKey"
FROM "QuoteTemplateLine" q
WHERE EXISTS (SELECT 1 FROM "BoHangMuc" b WHERE b."id" = q."templateId")
  AND NOT EXISTS (
      SELECT 1 FROM "BoHangMucPhan" p
      WHERE p."boHangMucId" = q."templateId"
        AND p."ma" = trim(COALESCE(q."sourceSectionCode", ''))
  )
ON CONFLICT ("id") DO NOTHING;
