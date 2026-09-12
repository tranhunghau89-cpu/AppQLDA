-- Dự toán thi công ghi lại XUẤT XỨ của dòng khi nó được đổ xuống từ dự toán chào giá.
--
-- Đây là migration DUY NHẤT trong cả loạt thư viện đơn giá được phép nhắc tên
-- EstimateItem — bảng đang giữ 516 dòng vận hành trên 124 dự án.
--
-- Ba cột đều NULL và KHÔNG có DEFAULT, không có UPDATE nào đi kèm: Postgres chỉ sửa
-- mô tả bảng chứ không viết lại từng dòng, nên 516 dòng cũ không bị chạm vào và cũng
-- không khoá bảng lâu. Dòng cũ nhận NULL là đúng nghĩa — chúng nhập từ Excel, không
-- đến từ thư viện nào cả.
--
-- Vì sao cần cả khuVucId khi đã có donGiaId: hai cột trả lời hai câu khác nhau.
-- donGiaId nói "bản giá nào sinh ra con số này" — và bản giá chung toàn quốc có
-- khuVucId NULL. khuVucId ở đây nói "lúc lập, ta đang tính giá cho vùng nào". Một
-- dòng lập cho Tây Ninh nhưng phải dùng giá chung vì chưa khai giá vùng là trường hợp
-- có thật và thường xuyên; thiếu cột này thì về sau không ai truy lại được.

-- AlterTable
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "congTacId" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "donGiaId" TEXT;
ALTER TABLE "EstimateItem" ADD COLUMN IF NOT EXISTS "khuVucId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EstimateItem_congTacId_idx" ON "EstimateItem"("congTacId");

-- AddForeignKey
--
-- Cả ba SET NULL, không CASCADE. Xoá một công tác, một bản giá hay một khu vực khỏi
-- thư viện là việc dọn danh mục; nó không được phép kéo theo dòng chi phí của một
-- công trình đang thi công. Dòng mất đường tra ngược nhưng giữ nguyên tên, khối lượng
-- và số tiền — đó mới là thứ kế toán và mua hàng đang dùng.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstimateItem_congTacId_fkey') THEN
        ALTER TABLE "EstimateItem"
            ADD CONSTRAINT "EstimateItem_congTacId_fkey"
            FOREIGN KEY ("congTacId") REFERENCES "CongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstimateItem_donGiaId_fkey') THEN
        ALTER TABLE "EstimateItem"
            ADD CONSTRAINT "EstimateItem_donGiaId_fkey"
            FOREIGN KEY ("donGiaId") REFERENCES "DonGiaCongTac"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EstimateItem_khuVucId_fkey') THEN
        ALTER TABLE "EstimateItem"
            ADD CONSTRAINT "EstimateItem_khuVucId_fkey"
            FOREIGN KEY ("khuVucId") REFERENCES "KhuVuc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
