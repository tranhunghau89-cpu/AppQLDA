-- Bổ sung index cho QuoteItem.sectionId — bị sót ở 20260910120000_fk_indexes.
--
-- Migration đó đã thêm index cho Quote.projectId, QuoteSection.quoteId,
-- QuoteSection.parentId và QuoteItem.quoteId, nhưng bỏ quên QuoteItem.sectionId.
-- Đây là khóa ngoại đang được đọc thật: saveItem() chạy
-- `quoteItem.aggregate({ where: { sectionId } })` để tính sortOrder ở MỖI lần
-- thêm dòng, và phần suy đơn giá m² (báo giá gửi khách) cộng tiền theo từng
-- "phần" nên cũng đọc theo sectionId.
--
-- IF NOT EXISTS nên chạy lại an toàn.

CREATE INDEX IF NOT EXISTS "QuoteItem_sectionId_idx" ON "QuoteItem"("sectionId");
