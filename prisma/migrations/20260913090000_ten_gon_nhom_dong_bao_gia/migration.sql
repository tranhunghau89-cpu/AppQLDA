-- Tên gọn và nhóm của dòng dự toán chào giá.
--
-- Dự toán chào giá ghi TÊN ĐẦY ĐỦ của công tác, kèm thông số kỹ thuật ("Bulong neo M22
-- dày 650, CT34, xi kẽm ren"). Bảng giá vốn và dự toán thi công chỉ cần tên gọn ("Vật
-- tư") đứng dưới một nhóm ("Bulong neo"). Hai con chữ khác nhau cho cùng một dòng, nên
-- phải lưu cả hai — không suy được cái này ra cái kia.
--
-- Chỉ THÊM cột nullable, không DEFAULT, không UPDATE: dòng cũ nhận NULL và hiển thị lùi
-- về tên đầy đủ.
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "tenGon" TEXT;
ALTER TABLE "QuoteItem" ADD COLUMN IF NOT EXISTS "groupLabel" TEXT;
