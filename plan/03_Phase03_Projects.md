# Phase 03 — Quản lý dự án (list + detail + status)

## Mục tiêu
Module trung tâm thay sheet TongHop + Nxxx (phần thông tin). Danh sách lọc được, trang chi tiết, đổi trạng thái, gán NCC theo hạng mục.

## File tạo
- `src/app/(app)/projects/actions.ts` — saveProject, deleteProject, updateStatus, setProjectSupplier.
- `src/app/(app)/projects/page.tsx` — server: fetch projects + customer + status; render ProjectList.
- `src/app/(app)/projects/ProjectList.tsx` — client: bảng + filter (status/CĐT/search) + modal thêm/sửa.
- `src/app/(app)/projects/[id]/page.tsx` — server: chi tiết 1 dự án (thông tin + NCC + status). Tabs tiến độ/dự toán sẽ thêm ở Phase 04/05.
- `src/app/(app)/projects/[id]/ProjectDetail.tsx` — client: đổi status, gán NCC theo component.
- `src/components/ui/StatusBadge.tsx` — badge trạng thái dùng chung.

## Trường dự án
code (unique), name, buildingType, status, location, customerId, startDate, endDate, kK/kL/kH, area, salePrice, note.

## Quyền
- project view: tất cả role; edit: ADMIN/SALES/ENGINEERING. PROCUREMENT chỉ xem.
- updateStatus & saveProject: requirePermission("project","edit").

## Verification
1. `/projects`: thấy 6 dự án seed; lọc theo trạng thái/CĐT; tìm theo mã/tên.
2. Thêm dự án mới (mã N100) → xuất hiện trong danh sách + DB.
3. Mở chi tiết N037 → thấy thông tin, CĐT, NCC theo hạng mục.
4. Đổi trạng thái → badge cập nhật.
5. `npm run build` không lỗi.
