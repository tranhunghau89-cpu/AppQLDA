-- Nhật ký trao đổi với chủ đầu tư: ai đã liên hệ, nói gì, hẹn gọi lại lúc nào.
--
-- Hai quyết định cố ý:
--   · clientQuoteId ON DELETE SET NULL (không CASCADE) — xóa một bản báo giá không
--     được xóa lịch sử liên hệ; cuộc gọi đã xảy ra thì vẫn đã xảy ra.
--   · authorId KHÔNG có khóa ngoại tới User, và authorName được chụp lại lúc ghi —
--     cùng lý lẽ với AuditLog: nhật ký phải sống sót khi tài khoản bị xóa.
--
-- Chỉ số nextFollowUpDate phục vụ bản tin nhắc việc hằng ngày (api/cron/reminders).
--
-- Toàn bộ migration này là THÊM MỚI — không DROP, không đổi cột bảng cũ — nên chạy
-- được trên cơ sở dữ liệu đang phục vụ mà không cần dừng hệ thống, và chạy lại được.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "clientQuoteId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'KHAC',
    "contactDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerNote_customerId_contactDate_idx" ON "CustomerNote"("customerId", "contactDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerNote_clientQuoteId_idx" ON "CustomerNote"("clientQuoteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerNote_nextFollowUpDate_idx" ON "CustomerNote"("nextFollowUpDate");

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_clientQuoteId_fkey" FOREIGN KEY ("clientQuoteId") REFERENCES "ClientQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
