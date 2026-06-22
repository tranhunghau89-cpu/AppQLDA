# Phase 11 — Đơn hàng & Mua hàng

## Mục tiêu
Thêm module **Đơn đặt hàng (mua hàng)** gửi nhà cung cấp:
- Bóc **chi tiết từng dòng vật tư** từ file đơn hàng Excel (nhiều sheet).
- Theo dõi **NCC + trạng thái mua hàng (Nháp → Đã đặt → Đã nhận) + giá trị + ngày đặt/nhận**.
- Mở file đơn gốc từ web.
- Nhập sẵn 8 file (4 dự án: K16L20/N050, K17L27/N053, K10L54/N054, K20L30/N055), mỗi dự án 1 đơn BL + 1 đơn TON.

## Nguồn dữ liệu
File `...RaDonHang\<dự án>\MH\<ngày>_DH_<BL|TON>_<mã>.xlsx`. Mỗi file = 1 đơn đặt hàng, nhiều sheet:
- **BL**: `1. BLLK`, `2. Cáp mái`, `2. Rod`, `3. Ty Xà Gồ` (bulong, cáp, ty xà gồ — có cột trọng lượng kg).
- **TON**: `Tôn Mái`, `Tôn vách`, `Tôn Vòm`, `Tôn Sàn`, `Cách nhiệt`, `MX`, `Diềm`, `Phụ kiện`, `Thép hình V`, `Ống nước`, `Panel`, `Cửa Lùa`…
- Sheet phụ trợ `Data1/Data2/STD Cáp` → bỏ qua (không có marker "ĐƠN ĐẶT HÀNG").

## Quy tắc parse (đã kiểm chứng prototype — ~471 dòng/8 file)
- Chỉ xử lý sheet có chữ "ĐẶT HÀNG" ở vài hàng đầu (cột A).
- Tìm **dòng header** = hàng có cột A == "STT". Map cột **theo nhãn đã fold dấu** (đ→d, bỏ dấu): `tên hàng/quy cách`→name, `sl`→qty, `đơn vị`→unit, `đơn giá`→price, `thành tiền`→amount, `trọng lượng`→weight, `ghi chú`→note.
- Đọc dòng dưới header tới khi gặp "Tổng cộng":
  - Cột A 1 chữ cái → dòng nhóm hạng mục (group = tên ở cột name) — BL.
  - Cột name trống + cột A có chữ → tiêu đề mục (group = text cột A) — TON.
  - Còn lại có name + (qty>0 hoặc weight>0) → **1 dòng vật tư**.
- `category` (loại đơn) từ tên file: DH_BL→BL, DH_TON→TON, DH_PANEL→PANEL, DH_CuaLua→CUALUA, DH_PK→PK.
- `orderDate` từ tiền tố tên file `YY_MMDD` (26_0507 → 2026-05-07). `orderNo` = tên file.
- `value` = Σ amount (đơn giá thường trống → 0, điền sau). `totalWeight` = Σ weight.
- NCC: lấy NCC đã gán cho dự án theo component (BL→BLLK/BL_NEO, TON→TON) nếu có.

## Data model (Prisma)
```
model PurchaseOrder {
  id, projectId(FK Cascade), orderNo?, orderDate?, category,
  supplierId?(FK SetNull), status(DRAFT|ORDERED|RECEIVED def DRAFT),
  orderedDate?, receivedDate?, value?, totalWeight?, filePath?, note?,
  createdAt, updatedAt, items PurchaseOrderItem[]
}
model PurchaseOrderItem {
  id, orderId(FK Cascade), category?(loại sheet: BLLK, Tôn mái...), groupName?(HM khung mái...),
  name, unit?, qty?, unitPrice?, amount?, weight?, note?, sortOrder
}
```
Project += `purchaseOrders`; Supplier += `purchaseOrders`.

## File tạo / sửa
- `prisma/schema.prisma` + migration `add_purchase_order`.
- `src/lib/constants.ts` — `PO_CATEGORY` (BL/TON/PANEL/CUALUA/PK/KHAC), `PO_STATUS` (Nháp/Đã đặt/Đã nhận).
- `src/lib/rbac.ts` — resource `purchase` (ADMIN/PROCUREMENT sửa, SALES/ENG xem).
- `scripts/import-orders.ts` + `package.json` script `import:orders`.
- `src/app/(app)/purchases/page.tsx` — danh sách đơn hàng.
- `src/app/(app)/projects/[id]/purchase/{page.tsx,PurchaseEditor.tsx,actions.ts}`.
- `src/app/api/purchases/[id]/file/route.ts` — stream file đơn.
- `src/components/layout/Sidebar.tsx` + `projects/[id]/page.tsx` — nav + thẻ.

## RBAC
| Bộ phận | purchase |
|---|---|
| ADMIN | Sửa |
| PROCUREMENT (Vật tư/Mua hàng) | Sửa |
| SALES | Xem |
| ENGINEERING | Xem |

## Verification
1. `prisma migrate dev`; `npm run import:orders` chạy không lỗi, in bảng (8 đơn, ~471 dòng).
2. DB: N050 có 2 đơn (BL+TON); đơn BL có dòng "M20x70" qty 117 weight 36.27.
3. `/purchases`: liệt kê đơn + dự án + loại + NCC + trạng thái + giá trị/trọng lượng + file.
4. `/projects/{id}/purchase`: xem dòng theo nhóm, sửa trạng thái Đã đặt/Đã nhận, mở file.
5. RBAC: PROCUREMENT sửa được; SALES chỉ xem. Build xanh; chạy lại import không nhân đôi.
