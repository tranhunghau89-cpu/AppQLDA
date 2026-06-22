# Phase 05 — Dự toán + Chi phí / Lợi nhuận

## Mục tiêu
Thay K20L20 + mục IV sheet Nxxx: nhập dự toán theo nhóm, tính tổng chi phí, lợi nhuận, biên LN, chi phí/m². Trang tổng hợp toàn bộ dự án.

## Tính toán (src/lib/profit.ts)
- `amount` mỗi dòng: nếu nhập sẵn dùng luôn; nếu trống = (actualQty ?? designQty ?? 0) × (unitPrice ?? 0).
- totalCost = Σ amount (mọi nhóm đều là chi phí).
- profit = salePrice − totalCost; margin = profit / salePrice.
- costPerM2 = totalCost / area; subtotal theo nhóm.

## File tạo
- `src/lib/profit.ts` — computeProfit(items, salePrice, area) + computeAmount(item).
- `src/app/(app)/projects/[id]/estimate/{page.tsx, actions.ts, EstimateEditor.tsx}` — editor dự toán 1 dự án.
- `src/app/(app)/estimates/page.tsx` — bảng tổng hợp tất cả dự án: chi phí / giá bán / lợi nhuận / biên / chi phí-m².
- Chi tiết dự án: thêm Card tóm tắt chi phí/LN + link sang trang dự toán.

## Quyền
- estimate edit: ADMIN/PROCUREMENT. profit view: ADMIN/SALES (xem lợi nhuận). Editor cho phép view mọi role, sửa theo quyền.

## Verification
1. `/projects/[N037]/estimate`: thấy dòng dự toán seed (thép tổ hợp 366,338,280…), tổng chi phí + lợi nhuận tính đúng.
2. Thêm/sửa/xóa 1 dòng → tổng cập nhật.
3. `/estimates`: bảng tổng hợp, N037 hiển thị chi phí/LN; biên LN, chi phí/m².
4. Role PROCUREMENT sửa được dự toán; ENGINEERING chỉ xem.
5. `npm run build` không lỗi.
