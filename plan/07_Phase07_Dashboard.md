# Phase 07 — Dashboard + biểu đồ

## Mục tiêu
Thay dashboard tạm: thẻ thống kê + biểu đồ Recharts + danh sách cần chú ý.

## Nội dung
- Thẻ: Tổng dự án, Đang thi công (GIA_CONG+LAP_DUNG), Hoàn thành, (Doanh thu + Lợi nhuận nếu có quyền profit).
- Biểu đồ:
  - Cột/tròn: Số dự án theo trạng thái.
  - Cột: Giá bán vs Chi phí theo dự án (nếu profit) — top theo giá bán.
- Danh sách: 5 dự án cập nhật gần nhất (link chi tiết).

## File tạo/sửa
- `src/app/(app)/page.tsx` — server: tổng hợp số liệu, gate theo `profit` view.
- `src/app/(app)/DashboardCharts.tsx` — client: Recharts (BarChart trạng thái + BarChart CP/giá bán).

## Verification
1. `/` (admin): thẻ số liệu đúng (6 dự án, đếm theo trạng thái), biểu đồ hiển thị.
2. Role không có profit (ENGINEERING): không thấy doanh thu/lợi nhuận.
3. `npm run build` không lỗi.
