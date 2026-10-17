-- Khối lượng dẫn xuất cho dự toán thi công (Vận chuyển KCT = tổng kg thép của hạng mục...).
ALTER TABLE "EstimateItem" ADD COLUMN "napThamSo" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN "layTuThamSo" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN "heSoQuyDoi" DOUBLE PRECISION;

-- Gán tham số cho dòng ĐÃ CÓ, tra ngược bộ hạng mục. Chỉ dòng nằm trong hạng mục (đổ từ
-- chào giá / áp bộ); dự án cũ nhập Excel không có hạng mục thì giữ nguyên số đã nhập.
-- Một khoá tra ra nhiều cách khai khác nhau thì không đoán.

-- 1) Theo công tác thư viện.
WITH ts AS (
  SELECT "congTacId",
         MIN(NULLIF(TRIM("napThamSo"), '')) AS nap,
         MIN(NULLIF(TRIM("layTuThamSo"), '')) AS lay,
         MIN(COALESCE("heSoQuyDoi", 1)) AS hs
  FROM "BoHangMucDong"
  WHERE "congTacId" IS NOT NULL
    AND (NULLIF(TRIM("napThamSo"), '') IS NOT NULL OR NULLIF(TRIM("layTuThamSo"), '') IS NOT NULL)
  GROUP BY "congTacId"
  HAVING COUNT(DISTINCT COALESCE(TRIM("napThamSo"), '') || '|' || COALESCE(TRIM("layTuThamSo"), '') || '|' || COALESCE("heSoQuyDoi", 1)::text) = 1
)
UPDATE "EstimateItem" e
SET "napThamSo" = CASE WHEN ts.lay IS NULL THEN ts.nap END,
    "layTuThamSo" = ts.lay,
    "heSoQuyDoi" = CASE WHEN ts.lay IS NOT NULL THEN ts.hs END
FROM ts
WHERE e."congTacId" = ts."congTacId" AND e."sectionId" IS NOT NULL;

-- 2) Theo tên + đơn vị, cho dòng chưa gán được ở bước 1.
WITH ts AS (
  SELECT LOWER(TRIM("ten")) AS ten,
         LOWER(TRIM(COALESCE("donVi", ''))) AS dv,
         MIN(NULLIF(TRIM("napThamSo"), '')) AS nap,
         MIN(NULLIF(TRIM("layTuThamSo"), '')) AS lay,
         MIN(COALESCE("heSoQuyDoi", 1)) AS hs
  FROM "BoHangMucDong"
  WHERE NULLIF(TRIM("napThamSo"), '') IS NOT NULL OR NULLIF(TRIM("layTuThamSo"), '') IS NOT NULL
  GROUP BY 1, 2
  HAVING COUNT(DISTINCT COALESCE(TRIM("napThamSo"), '') || '|' || COALESCE(TRIM("layTuThamSo"), '') || '|' || COALESCE("heSoQuyDoi", 1)::text) = 1
)
UPDATE "EstimateItem" e
SET "napThamSo" = CASE WHEN ts.lay IS NULL THEN ts.nap END,
    "layTuThamSo" = ts.lay,
    "heSoQuyDoi" = CASE WHEN ts.lay IS NOT NULL THEN ts.hs END
FROM ts
WHERE e."sectionId" IS NOT NULL
  AND e."napThamSo" IS NULL AND e."layTuThamSo" IS NULL
  AND LOWER(TRIM(e."name")) = ts.ten
  AND LOWER(TRIM(COALESCE(e."unit", ''))) = ts.dv;

-- 3) Tính lại KL + thành tiền dòng dẫn xuất theo tổng nguồn cùng hạng mục — như
--    lib/khoiLuong/danXuatThiCong. Bỏ qua dòng có bảng bóc / mục con dự toán.
WITH src AS (
  SELECT "sectionId", "napThamSo" AS p, SUM("designQty") AS q
  FROM "EstimateItem"
  WHERE "sectionId" IS NOT NULL AND "napThamSo" IS NOT NULL AND "layTuThamSo" IS NULL AND "designQty" IS NOT NULL
  GROUP BY 1, 2
)
UPDATE "EstimateItem" e
SET "designQty" = ROUND((src.q * COALESCE(e."heSoQuyDoi", 1))::numeric, 3)::double precision,
    "amount" = CASE WHEN e."unitPrice" IS NULL THEN NULL
                    ELSE ROUND((src.q * COALESCE(e."heSoQuyDoi", 1))::numeric, 3)::double precision * e."unitPrice" END
FROM src
WHERE e."sectionId" = src."sectionId" AND e."layTuThamSo" = src.p
  AND NOT EXISTS (SELECT 1 FROM "ChiTietKhoiLuong" c WHERE c."estimateItemId" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "MucConDuToan" m WHERE m."estimateItemId" = e."id" AND m."loai" = 'DU_TOAN');
