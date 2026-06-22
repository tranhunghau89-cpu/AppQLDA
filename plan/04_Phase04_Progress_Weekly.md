# Phase 04 — Tiến độ (Milestone) + Nhật ký tuần (WeeklyLog)

## Mục tiêu
- Quản lý mốc tiến độ (kế hoạch/thực tế/hoàn thành) trên trang chi tiết dự án.
- Trang Nhật ký tuần thay sheet TDDA_Tuan: mỗi dự án 1 dòng, ghi chú theo tuần.

## File tạo/sửa
- `src/lib/week.ts` — tính ISO week + năm hiện tại, nhãn "Tuần n (dd/MM–dd/MM)".
- `src/app/(app)/projects/actions.ts` — thêm `upsertMilestone`.
- `src/app/(app)/projects/[id]/Milestones.tsx` — client: lưới 8 mốc, sửa ngày KH/TT + done.
- `src/app/(app)/projects/[id]/page.tsx` — thêm Card "Tiến độ".
- `src/app/(app)/weekly/{page.tsx, actions.ts, WeeklyBoard.tsx}` — bảng tuần: chọn tuần, cột tuần hiện tại sửa được + vài tuần trước (xem), trạng thái.

## Quyền
- progress edit: ADMIN/ENGINEERING. SALES/PROCUREMENT chỉ xem.

## Verification
1. Chi tiết N037: chỉnh mốc Gia công (ngày KH/TT, tick hoàn thành) → lưu, hiển thị lại.
2. `/weekly`: chọn tuần 25/2026 → thấy ghi chú seed (N055/N056/N051); thêm ghi chú tuần cho 1 dự án khác → lưu.
3. Role SALES: ô nhập tiến độ bị khóa (chỉ xem).
4. `npm run build` không lỗi.
