import { permanentRedirect } from "next/navigation";

/**
 * Địa chỉ cũ của trang in báo giá gửi khách.
 *
 * Từ Phase 8.4 báo giá sống được ở cơ hội chào giá nữa, nên trang in chuyển về
 * `/bao-gia/<id>/print` — một địa chỉ cho cả hai nơi. Giữ lại chặng chuyển hướng này vì
 * đường dẫn cũ đã nằm trong lịch sử trình duyệt và trong các bản in đã gửi đi.
 *
 * Không kiểm quyền ở đây: trang đích tự kiểm, và kiểm hai lần bằng hai luật khác nhau
 * là cách sinh ra hai câu trả lời khác nhau.
 */
export default async function ClientQuotePrintRedirect({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const { quoteId } = await params;
  permanentRedirect(`/bao-gia/${quoteId}/print`);
}
