# Phase 15 — Module Tổng hợp chi phí (Quyết toán thực tế)

## Mục tiêu
Nhập 4 file THCP (`AppQLDA/THCPMau/*.xlsx`) — bảng quyết toán chi phí thực tế của dự án — vào app dưới dạng **module mới độc lập**, đầy đủ 3 phần, và cập nhật dashboard.

## Nguồn dữ liệu (mỗi file = 1 dự án, 1 sheet)
- **Thông tin DA**: CĐT (C3), Tên/Kích thước (D4, vd K19L42_HN), Vị trí (D5).
- **Tài chính** (rows ~9–13): Doanh Thu, Chi phí, LNTT, "VAT được nhận thêm"; cột D=Đã Chi cả V, E=Đã Thu cả V, F=CL Thu-Chi, G=Còn Phải thu (G đôi khi là chữ "đã thu đủ").
- **Tổng hợp hạng mục** (10 nhóm A–K): HẠNG MỤC | NCC | GIÁ TRỊ | THANH TOÁN | HÓA ĐƠN.
- **Chi tiết chi phí** (A–K, từng dòng): Hạng Mục | Khối lượng | Đơn giá | Thành tiền | Thời gian(F) | Ghi chú(G).

## Quyết định (đã chốt với user)
1. Module mới riêng "Tổng hợp chi phí".
2. Nhập đầy đủ cả 3 phần.
3. DA Ba Vì (K20L50_HN) **tạo mới** (N004 là K20L50_TQ — khác tỉnh). 3 file còn lại khớp: Hà Nam→N039, Ninh Bình→N026, Tây Ninh→N031.
4. Cập nhật dashboard: set `project.salePrice = doanh thu`; dashboard ưu tiên số liệu CostSummary (revenue/cost/profit).

## Data model (Prisma)
- `CostSummary` (1-1 Project, `projectId @unique`): revenue, cost, profit, extraVat, paidWithVat, collectedWithVat, receivable, collectionNote, filePath, note.
- `CostCategory` (A–K): code, groupCode (map ESTIMATE_GROUP), name, supplier, value, payment, invoice, sortOrder.
- `CostItem`: name, qty, unitPrice, amount, ref(F), note(G), sortOrder.
- Project += `costSummary CostSummary?`. Migration `add_cost_summary`.

## File tạo / sửa
- `prisma/schema.prisma` + migration.
- `src/lib/constants.ts`: `COST_CATEGORY` (A–K → label + group).
- `src/lib/rbac.ts`: resource `cost` (ADMIN edit; SALES, PROCUREMENT view).
- `scripts/import-thcp.ts` + `package.json` script `import:thcp`.
- `src/app/(app)/costs/page.tsx` (list) + `/projects/[id]/cost/page.tsx` (chi tiết) + `api/costs/[id]/file/route.ts`.
- `src/components/layout/Sidebar.tsx` (nav "Tổng hợp chi phí"), `projects/[id]/page.tsx` (thẻ), dashboard `page.tsx` (ưu tiên CostSummary).
- README + memory.

## Import logic
- Tài chính: dò theo nhãn cột B ("Doanh Thu"/"Chi phí"/"LNTT"/"VAT được nhận thêm"); paid/collected/receivable lấy giá trị số ở cột D/E/G bất kỳ dòng 10–13; G là chữ → `collectionNote`, receivable=null.
- Hạng mục: từ header B="HẠNG MỤC", 10 dòng A–K.
- Chi tiết: từ "CHI TIẾT CHI PHÍ"; A=1 chữ cái → nhóm hiện tại; dòng có tên + (KL/ĐG/TT) → item; dừng sau chuỗi dòng trống dài.
- Khớp DA theo dims + tỉnh; Ba Vì tạo mới (code = N + max#+1; tạo/gán Customer "Tân Đại Phong").
- Idempotent: xoá CostSummary của DA rồi tạo lại (cascade). Set salePrice = revenue.

## Verification
1. `npm run import:thcp` → 4 DA, in bảng doanh thu/chi phí/LNTT khớp file.
2. `npx tsc --noEmit` xanh.
3. `/costs`: 4 dòng, số liệu khớp; mở `/projects/<id>/cost`: thẻ tài chính + bảng hạng mục (NCC/giá trị/thanh toán/hóa đơn) + chi tiết từng nhóm; mở file gốc.
4. Dashboard: doanh thu/chi phí/lợi nhuận đã gồm 4 DA này (LNTT khớp).
5. DA Ba Vì xuất hiện như dự án mới.
