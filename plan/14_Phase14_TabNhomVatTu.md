# Phase 14 — Tab nhóm vật tư + tab Tổng hợp (trang Đơn hàng)

## Mục tiêu
Trong **mỗi đơn hàng** (OrderCard), thay vì xếp chồng các bảng nhóm vật tư, hiển thị **thanh tab**:
- Mỗi nhóm (theo "Gom theo": Nhóm vật tư hoặc Hạng mục) = 1 tab, có badge số dòng.
- 1 tab **Tổng hợp** gồm: (a) bảng **tóm tắt theo nhóm** (số dòng, khối lượng, giá trị + dòng Tổng cộng) và (b) bảng **toàn bộ vật tư gộp** (có cột nhóm, sortable).

## File sửa
- `src/app/(app)/projects/[id]/purchase/PurchaseEditor.tsx`:
  - Tách `ItemsTable` (THead + tbody dùng chung) — prop `showGroupCol`/`groupColLabel` để bảng gộp có thêm cột nhóm.
  - OrderCard: state `tab` (mặc định `__summary__`), `current` fallback về Tổng hợp nếu tab nhóm không còn (đổi Gom theo), `summary` (reduce theo nhóm), `allRows` (sortRows toàn bộ).
  - Tab bar + panel; xóa render xếp chồng cũ. Giữ footer tổng (số dòng/KL/giá trị) và "Gom theo"/sort toàn cục.

## Tương tác
- "Gom theo" (Nhóm vật tư ↔ Hạng mục) đổi danh sách tab; cột nhóm trong bảng gộp đổi nhãn tương ứng.
- Bấm tiêu đề cột vẫn sort trong từng tab nhóm và trong bảng gộp.

## Verification
1. `npx tsc --noEmit` xanh.
2. Mở `/projects/<id>/purchase`: mỗi đơn có tab các nhóm + tab Tổng hợp (mặc định mở Tổng hợp).
3. Tab Tổng hợp: bảng tóm tắt khớp số dòng/KL từng nhóm + Tổng cộng = footer; bảng toàn bộ có cột nhóm.
4. Bấm 1 tab nhóm → chỉ vật tư nhóm đó. Đổi "Gom theo" Hạng mục → tab đổi theo hạng mục.
5. Sort cột trong tab nhóm và trong bảng gộp đều chạy.
