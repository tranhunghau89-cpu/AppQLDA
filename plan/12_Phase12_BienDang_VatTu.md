# Phase 12 — Hình ảnh biên dạng vật tư (diềm, tôn vòm…)

## Mục tiêu
Vật tư có biên dạng (diềm, tôn vòm, máng xối, tôn vách…) trong file đơn TON có **ảnh quy cách nhúng sẵn**.
Trích ảnh đó, gắn vào đúng dòng vật tư, hiển thị trong trang Đơn hàng.

## Phát hiện
- File `DH_TON_*.xlsx` nhúng 20–25 ảnh PNG (`xl/media/`) + drawing anchors.
- Ảnh ở dòng ~0 (anchor row 1) = **logo công ty** (lặp mọi sheet) → bỏ.
- Ảnh khác = **biên dạng** gắn ở/gần dòng vật tư (Diềm 12 ảnh dòng 12–31, Tôn vòm dòng 14, Máng xối dòng 14, Tôn vách…). Ảnh thật chứa kích thước/góc + "Mặt màu".
- ExcelJS đọc được: `ws.getImages()` → `{imageId, range.tl.row}` (0-based) ; `wb.getImage(id)` → `{buffer, extension}`.

## Cách làm
- **Lưu ảnh trong DB** (SQLite BLOB) — model `PoItemImage { id, itemId(FK Cascade), mime, data Bytes, sortOrder }`. PurchaseOrderItem += `images`.
- Importer (`import-orders.ts`) bổ sung:
  - Mỗi sheet: tính `anchorRow = floor(tl.row)+1`; bỏ ảnh có `anchorRow < headerRow` (logo/header).
  - Gắn ảnh vào **dòng vật tư gần nhất phía trên** trong cùng sheet (`max row ≤ anchorRow`; nếu không có → dòng đầu sheet).
  - Tạo `PoItemImage` (buffer + mime) cho item tương ứng.
- API `/api/po-images/[id]` → stream ảnh từ DB (kiểm tra quyền `purchase` view).
- `PurchaseEditor`: dòng nào có ảnh → hiện **thumbnail** dưới tên (bấm mở ảnh lớn ở tab mới).

## File tạo / sửa
- `prisma/schema.prisma` + migration `add_po_item_image`.
- `scripts/import-orders.ts` — trích + match + tạo PoItemImage (parseSheet trả thêm `row` + `headerRow`).
- `src/app/api/po-images/[id]/route.ts` — stream ảnh.
- `src/app/(app)/projects/[id]/purchase/{page.tsx,PurchaseEditor.tsx}` — load + hiển thị thumbnail.

## Idempotent
- Re-run import:orders xoá PurchaseOrder theo project+category → cascade xoá item + ảnh, rồi tạo lại.

## Verification
1. `prisma migrate dev`; `npm run import:orders` chạy không lỗi, in số ảnh trích được (>0).
2. DB: PoItemImage có bản ghi; ảnh diềm gắn vào item nhóm "Diềm".
3. Web `/projects/{id}/purchase` (N050): dòng Diềm/Tôn vòm hiện thumbnail biên dạng; bấm mở ảnh đầy đủ (kích thước/góc).
4. Build xanh; chạy lại import không nhân đôi ảnh.
