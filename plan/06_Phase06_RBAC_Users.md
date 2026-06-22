# Phase 06 — Siết phân quyền (RBAC) + Quản lý người dùng

## Mục tiêu
- Chặn truy cập trang theo quyền view (không chỉ ẩn nút).
- Sidebar lọc menu theo quyền.
- Trang /users (chỉ ADMIN) quản lý tài khoản + vai trò.

## File tạo/sửa
- `src/lib/auth.ts` — thêm `requireView(resource)` (redirect "/" nếu thiếu quyền view).
- `src/components/layout/Sidebar.tsx` — gắn `resource` cho mỗi mục, lọc bằng `can(role, resource, "view")`.
- Áp `requireView` cho các page: customers(customer), suppliers(supplier), estimates(estimate), weekly(progress), projects(project), users(user).
- `src/app/(app)/users/{page.tsx, actions.ts, UserManager.tsx}` — CRUD user (email, tên, vai trò, active, đặt lại mật khẩu).

## Quy tắc an toàn
- Không tự xóa tài khoản đang đăng nhập.
- Mật khẩu: tạo mới bắt buộc; sửa thì để trống = giữ nguyên.

## Verification
1. Đăng nhập PROCUREMENT → menu không có "Chủ đầu tư"; vào thẳng /customers bị đẩy về "/".
2. Đăng nhập ADMIN → thấy menu Người dùng; tạo user mới role SALES, đăng nhập thử được.
3. Sửa vai trò user → quyền đổi theo.
4. Không xóa được chính mình.
5. `npm run build` không lỗi.
