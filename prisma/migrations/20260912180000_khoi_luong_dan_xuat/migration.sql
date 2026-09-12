-- Khối lượng dẫn xuất trên dòng dự toán chào giá.
--
-- Vận chuyển KCT, Lắp dựng KCT, Lợp tôn, Bắn đinh chống cắt không có khối lượng riêng:
-- chúng bằng đúng khối lượng của các dòng phía trên trong cùng phần. Bộ hạng mục đã khai
-- quan hệ này từ lâu (21 dòng DERIVED), nhưng dòng dự toán chưa mang nó nên áp bộ xong là
-- quan hệ đứt, người lập phải chép tay lại con số.
--
-- CHỈ THÊM, và chỉ trên "QuoteItem" — bảng dự toán thi công không bị đụng tới. (Cố ý
-- không viết tên bảng đó ra đây: phép kiểm trước mỗi lần deploy là grep tên nó trong
-- migration, nên nhắc tên trong lời chú thích cũng làm phép kiểm báo động giả.)

-- Tên tham số dòng này NẠP vào (KCT_KG, TON_M2, DINH_BO, DECK_M2).
ALTER TABLE "QuoteItem" ADD COLUMN "napThamSo" TEXT;
-- Tên tham số dòng này LẤY ra. Khác NULL nghĩa là dòng dẫn xuất — không cần thêm một cột
-- "vaiTro" nữa: hai cột cùng nói một điều thì sớm muộn cũng lệch nhau.
ALTER TABLE "QuoteItem" ADD COLUMN "layTuThamSo" TEXT;
-- Hệ số nhân khi lấy. Để trống hiểu là 1; không đặt DEFAULT để 71 dòng cũ và mọi dòng gõ
-- tay giữ nguyên trạng thái "không dính dáng gì tới cơ chế này".
ALTER TABLE "QuoteItem" ADD COLUMN "heSoQuyDoi" DOUBLE PRECISION;

-- Tra "các dòng dẫn xuất của bản này" mỗi lần sửa một dòng nguồn.
CREATE INDEX "QuoteItem_quoteId_layTuThamSo_idx" ON "QuoteItem"("quoteId", "layTuThamSo");
