# Phase 19C — Dán từ Excel (bulk paste, desktop)

> Nối tiếp Phase 19 A+B (Quick-Add hub). Ngày: 2026-08-03.
> Mục tiêu: NV văn phòng dán 1 vùng Excel (nhiều dòng) → xem trước, sửa được → nhập hàng loạt 1 lần.
> Chỉ hiện trên desktop (ẩn mobile). Vẫn kiểm scope (vai trò × dự án được giao) như A+B.

## Phạm vi
Áp cho 3 loại bảng nhiều dòng:
- **Đơn hàng / vật tư** — dán dòng vật tư `[Tên, ĐV, SL, Đơn giá]` → 1 `PurchaseOrder` (DRAFT) + n items. Chọn NCC + loại 1 lần phía trên bảng.
- **Dự toán / khối lượng** — dán `[Nhóm, Hạng mục, ĐV, KL, Đơn giá]` → n `EstimateItem`. Cột Nhóm map text→code (`ESTIMATE_GROUP`), sửa được bằng select trong preview.
- **Chi phí / thanh toán** — dán `[Loại(Thu/Chi), Tên đợt, Số tiền, Hạn, CĐT/NCC, Ghi chú]` → n `Payment`.

Tiến độ/nhật ký (ảnh) KHÔNG có chế độ dán (mỗi lần 1 ghi chú).

## File tạo / sửa
1. **`src/app/(app)/quick/PasteTable.tsx`** (mới, client) — component dùng chung:
   - `props`: `{ columns: PasteColumn[]; requiredKey: string; onConfirm(rows): Promise<BulkResult>; pending; hint? }`.
   - `PasteColumn = { key; label; kind?: "text"|"number"|"select"; options?; normalize?(raw):string; span? }`.
   - Textarea "Dán từ Excel" → parse: tách `\n` (dòng, bỏ dòng trắng) và `\t` (cột) → map cell[i]→columns[i].key; select chạy `normalize`.
   - Bảng preview **sửa được** (input/select mỗi ô) + nút xóa dòng. Dòng thiếu `requiredKey` bị đánh dấu, không nhập.
   - Nút "Xác nhận nhập N dòng" → `onConfirm(validRows)`; ok → clear + báo số dòng.
2. **`src/app/(app)/quick/actions.ts`** (sửa) — thêm 3 bulk action (đều `scope()` + `requirePermission`):
   - `bulkPurchase(projectId, supplierId, category, rows)` → 1 PO + items; value=Σ.
   - `bulkEstimate(projectId, rows)` → `estimateItem.createMany`; groupCode normalize, amount=KL×ĐG.
   - `bulkPayment(projectId, rows)` → `payment.createMany`; direction chuẩn hóa THU/CHI.
   - Kiểu trả `BulkResult = { ok:true; count:number } | { ok:false; error:string }`.
   - `rows: Record<string,string>[]` (serializable qua server action).
3. **`src/app/(app)/quick/QuickAdd.tsx`** (sửa) — thêm chuyển chế độ "Nhập 1 dòng ⟷ Dán bảng" (chỉ desktop, `hidden sm:...`); tab "Dán bảng" hiện `PasteTable` theo loại đang chọn (purchase/estimate/payment). Note không có dán.

## Chuẩn hóa (helpers trong actions.ts)
- `num(s)`: bỏ `. , khoảng trắng` → Number | null.
- `normGroup(raw)`: so khớp `ESTIMATE_GROUP` theo value hoặc label (không dấu, lowercase) → code; fallback `"KHAC"`.
- `normDirection(raw)`: chứa "chi"/"tra"→CHI; mặc định THU.

## Data flow / lỗi
- Client dựng `rows` từ preview → gọi bulk action → zod-lite parse + scope + `createMany` → `revalidatePath`.
- Lỗi permission/scope → thông báo tiếng Việt.
- Không transaction phức tạp: estimate/payment dùng `createMany`; purchase 1 `create` lồng items.

## Verification
1. `next build` OK (chỉ src sạch).
2. Playwright desktop: đăng nhập admin → Quick-Add → "Dán bảng" → dán 3 dòng dự toán (có Tab/Newline) → preview đúng 3 dòng, group map đúng → xác nhận → kiểm DB có 3 EstimateItem → xóa dữ liệu test.
3. Mobile (resize): nút "Dán bảng" ẩn.
4. Scope: user non-admin không truy cập dự án ngoài phạm vi (bulk action chặn).

## Ngoài phạm vi
- Inline-grid trực tiếp trong trang danh sách.
- Dán kèm ảnh; import file đính kèm.
- Auto-detect cột theo header.
