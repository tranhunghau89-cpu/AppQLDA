# Phase 02 — Module Chủ đầu tư (CĐT) + Nhà cung cấp (NCC)

## Mục tiêu
CRUD đầy đủ cho Customer và Supplier, có kiểm tra quyền (RBAC), dùng Server Actions + modal form.

## Kiến trúc
- **Server Actions** (`actions.ts` mỗi module): create/update/delete. Mỗi action gọi `requirePermission(resource, "edit")`, validate bằng Zod, `revalidatePath`.
- **Server Component** `page.tsx`: `requirePermission(resource, "view")`, query DB, truyền data + `canEdit` xuống client.
- **Client Component** `*Manager.tsx`: bảng + nút Thêm/Sửa/Xóa, modal form, gọi server action.
- **Modal** UI primitive dùng chung (`src/components/ui/modal.tsx`).

## Quyền (theo ma trận)
- customer: ADMIN/SALES edit; ENGINEERING view; PROCUREMENT không thấy menu (nhưng route vẫn chặn view nếu vào thẳng → tạm cho view, siết ở Phase 06).
- supplier: ADMIN/PROCUREMENT edit; còn lại view.

## File tạo
- `src/components/ui/modal.tsx`
- `src/app/(app)/customers/{page.tsx, actions.ts, CustomerManager.tsx}`
- `src/app/(app)/suppliers/{page.tsx, actions.ts, SupplierManager.tsx}`
- `src/lib/permissions-client.ts` (tùy chọn) — không cần, truyền canEdit từ server.

## Verification
1. `/customers`: thêm/sửa/xóa CĐT → bảng cập nhật, lưu DB.
2. `/suppliers`: lọc theo loại, thêm NCC mới với category.
3. Đăng nhập role ENGINEERING → nút Thêm/Sửa CĐT ẩn (chỉ xem).
4. `npm run build` không lỗi.
