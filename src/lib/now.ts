// Một chỗ duy nhất đọc đồng hồ hệ thống.
//
// Gọi `Date.now()` thẳng trong thân component vi phạm quy tắc "render phải thuần"
// của React 19 (react-hooks/purity): kết quả đổi giữa các lần render, gây lệch
// hydration ở client component và số liệu không ổn định ở server component.
//
// Quy ước trong repo: server component lấy mốc thời gian một lần bằng `serverNow()`
// rồi TRUYỀN XUỐNG client component qua props — client không tự đọc đồng hồ khi render.
import "server-only";

/** Mốc thời gian của request hiện tại (ms). Chỉ gọi ở Server Component / Server Action. */
export function serverNow(): number {
  return Date.now();
}
