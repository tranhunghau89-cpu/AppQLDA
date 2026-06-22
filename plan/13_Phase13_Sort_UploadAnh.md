# Phase 13 — Sort theo hạng mục/nhóm vật tư + Upload ảnh biên dạng

## Mục tiêu
Trang **Đơn hàng & Mua hàng** (`/projects/[id]/purchase`):
1. **Gom + sắp xếp** vật tư trong mỗi đơn:
   - Đổi tiêu chí gom: **Nhóm vật tư** (sheet: BLLK, Cáp mái…) hoặc **Hạng mục** (groupName).
   - Bấm tiêu đề cột (Tên hàng, Hạng mục/Nhóm, SL, Đơn giá, Thành tiền, TL) để sort tăng/giảm trong từng nhóm.
2. **Upload ảnh biên dạng từ web** (ngoài trích tự động từ Excel): mỗi dòng vật tư có nút thêm ảnh (nhiều file) + xóa từng ảnh. Lưu BLOB trong `PoItemImage` như ảnh trích từ Excel.

## File sửa / tạo
- `src/app/(app)/projects/[id]/purchase/actions.ts` — thêm 2 server action:
  - `uploadPurchaseItemImages(projectId, itemId, FormData files)` — đọc File → Buffer, validate `image/*`, lưu `PoItemImage` (sortOrder nối tiếp max hiện có).
  - `deletePurchaseItemImage(projectId, imageId)` — xóa 1 ảnh.
- `src/app/(app)/projects/[id]/purchase/PurchaseEditor.tsx` — thêm:
  - State `groupBy` ('category' | 'group') + thanh chọn segmented.
  - State `sort` {field, dir} + Th có thể bấm (mũi tên chỉ hướng).
  - OrderCard gom theo `groupBy`, sort rows theo comparator (số: numeric null-last; chuỗi: localeCompare).
  - Per-item: nút "＋ Ảnh" (input file ẩn, multiple, accept=image/*) + overlay nút xóa (×) trên thumbnail khi canEdit.

## Kiến trúc / data flow
- Quyền: dùng `requirePermission("purchase","edit")` cho upload/xóa ảnh (giống save/delete item).
- Upload: client build FormData(files) → gọi server action → `Buffer.from(await file.arrayBuffer())` → `db.poItemImage.create`. Sau đó `router.refresh()`.
- Sort/group thuần client (state), không đổi DB; thứ tự gốc giữ qua `sortOrder`.

## Verification
1. `npm run build` xanh (không lỗi TS).
2. Mở `/projects/<id>/purchase` 1 đơn Tôn:
   - Bấm "Gom theo: Hạng mục" → các dòng gom lại theo groupName; "Nhóm vật tư" → về theo sheet.
   - Bấm tiêu đề "TL (kg)" → sort tăng/giảm; mũi tên đổi hướng.
3. Bấm "＋ Ảnh" trên 1 dòng → chọn ảnh → thumbnail hiện ngay; bấm × → ảnh biến mất; reload vẫn đúng.
4. Re-run `npm run import:orders` không xóa ảnh upload tay (chỉ thay item theo cascade — lưu ý: import xóa+tạo lại item nên ảnh upload tay của dự án đó sẽ mất; ghi chú cho user).
