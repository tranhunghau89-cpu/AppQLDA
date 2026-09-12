-- Suất khối lượng: thư viện khối lượng mẫu nằm ngay trên dòng của bộ hạng mục.
--
-- Ý nghĩa: khối lượng của dòng này trên MỘT đơn vị diện tích của PHẦN chứa nó.
-- Ví dụ dòng "Thép tổ hợp cột, kèo" trong phần "Khung mái" mang suất 22 (kg/m² mái);
-- phần mái 1.500 m² thì khối lượng gợi ý là 33.000 kg.
--
-- Mẫu số là diện tích của CHÍNH phần đó, không phải diện tích sàn xây dựng: thép
-- khung mái tỉ lệ với m² mái, còn tôn thưng tỉ lệ với m² vách — hai con số khác nhau
-- và trộn chung sẽ sai ngay khi nhà có mái hiên hoặc cửa trời.
--
-- Cột `khoiLuongMacDinh` sẵn có GIỮ NGUYÊN: đó là số tuyệt đối cho những dòng không
-- tỉ lệ với diện tích (ví dụ "vận chuyển: 2 chuyến"). Suất có thì dùng suất, không
-- thì lùi về số tuyệt đối.
--
-- Định mức này chỉ áp cho KHỐI LƯỢNG. Đơn giá vẫn trọn gói nhập tay như đã chốt —
-- không suy giá từ hao phí vật tư.

ALTER TABLE "BoHangMucDong" ADD COLUMN IF NOT EXISTS "suatKhoiLuong" DOUBLE PRECISION;
