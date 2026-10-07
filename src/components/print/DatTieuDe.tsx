"use client";

import { useEffect } from "react";

/**
 * Đặt `document.title` — trình duyệt lấy nó làm tên tệp mặc định khi Lưu thành PDF.
 *
 * Không dùng thẻ <title> trong JSX: `metadata.title` của layout gốc đã chiếm thẻ <title>
 * đầu tiên trong <head>, và document.title luôn đọc thẻ đầu tiên đó.
 */
export function DatTieuDe({ ten }: { ten: string }) {
  useEffect(() => {
    document.title = ten;
  }, [ten]);
  return null;
}
