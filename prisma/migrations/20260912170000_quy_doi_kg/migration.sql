-- Quy đổi đơn vị ra kg cho bulong, ty xà gồ, ecu.
--
-- Bộ hạng mục bóc những thứ này theo KG (đó là cách đọc bản vẽ kết cấu), thư viện bán
-- theo BỘ/CÁI (đó là cách mua hàng). Hai đơn vị khác thứ nguyên nên không gắn thẳng mã
-- được. Trọng lượng một đơn vị là cầu nối, bảng cấu thành là chỗ khai tỉ lệ các cỡ.
--
-- CHỈ THÊM. Không cột nào có DEFAULT, không câu UPDATE nào, không bảng cũ nào bị đụng
-- tới — `migrate deploy` trên Supabase không lùi lại được.

-- Trọng lượng MỘT bộ/cái. Để trống với mọi công tác không cần quy đổi (tôn, thép, nhân
-- công), nên không có giá trị mặc định nào đúng — cột phải nullable.
ALTER TABLE "CongTac" ADD COLUMN "khoiLuongDonVi" DOUBLE PRECISION;

CREATE TABLE "BoHangMucDongChiTiet" (
    "id" TEXT NOT NULL,
    "dongId" TEXT NOT NULL,
    "congTacId" TEXT NOT NULL,
    -- Số bộ cho một công trình MẪU. Chỉ tỉ lệ giữa các cỡ vào kết quả, nên để trống
    -- lúc mới thêm cỡ là hợp lệ: dòng đó bị bỏ qua kèm cảnh báo chứ không hỏng bảng.
    "soLuong" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoHangMucDongChiTiet_pkey" PRIMARY KEY ("id")
);

-- Một cỡ chỉ được xuất hiện một lần trong bảng cấu thành của một dòng; khai hai lần là
-- cộng đôi khối lượng mà không ai nhìn ra.
CREATE UNIQUE INDEX "BoHangMucDongChiTiet_dongId_congTacId_key" ON "BoHangMucDongChiTiet"("dongId", "congTacId");
CREATE INDEX "BoHangMucDongChiTiet_dongId_sortOrder_idx" ON "BoHangMucDongChiTiet"("dongId", "sortOrder");
CREATE INDEX "BoHangMucDongChiTiet_congTacId_idx" ON "BoHangMucDongChiTiet"("congTacId");

ALTER TABLE "BoHangMucDongChiTiet" ADD CONSTRAINT "BoHangMucDongChiTiet_dongId_fkey"
    FOREIGN KEY ("dongId") REFERENCES "BoHangMucDong"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Xóa một công tác khỏi thư viện thì dòng cấu thành trỏ vào nó mất luôn: giữ lại một
-- dòng trỏ vào chỗ trống chỉ làm tổng khối lượng sai âm thầm. Đơn giá đã lưu trên dòng
-- bộ hạng mục là ảnh chụp nên không đổi, và màn hình sẽ báo lệch so với bảng.
ALTER TABLE "BoHangMucDongChiTiet" ADD CONSTRAINT "BoHangMucDongChiTiet_congTacId_fkey"
    FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE CASCADE ON UPDATE CASCADE;
