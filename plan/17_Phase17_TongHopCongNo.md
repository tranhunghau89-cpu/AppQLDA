# Phase 17 — Tổng hợp công nợ (CĐT & NCC)

## Mục tiêu
Thêm phần **tổng hợp công nợ** (chỉ đọc, không nhập tay) cho:
- **Phải thu** theo từng **Chủ đầu tư (CĐT)**.
- **Phải trả** theo từng **Nhà cung cấp (NCC)**.

Lấy số từ dữ liệu sẵn có (quyết toán, hợp đồng, đơn hàng). **Không đổi schema, không migration.**

## Cách tính

### Phải thu — theo CĐT (gộp các dự án của CĐT)
Mỗi dự án:
- `value` (giá trị HĐ/doanh thu) = `CostSummary.revenue` → nếu trống: `Contract.valueWithVat` (HĐ ký mới nhất) → nếu trống: `Project.salePrice`.
- `collected` (đã thu) = `CostSummary.collectedWithVat ?? 0`.
- `receivable` (còn phải thu) = `CostSummary.receivable` nếu có, ngược lại `value − collected`.

CĐT = Σ các dự án. Dự án không gán CĐT → nhóm "Chưa gán CĐT".

### Phải trả — theo NCC
- Đặt hàng = Σ `PurchaseOrder.value` (FK `supplierId`), theo dự án.
- Giá trị QT + đã trả = Σ `CostCategory.value` / `CostCategory.payment`, khớp NCC bằng **so tên chuẩn hóa** (`norm()` giống import-thcp: bỏ dấu, đ→d, chỉ a-z0-9).
- Per dự án: `base = qtValue > 0 ? qtValue : ordered`; `payable = base − paid`.
- NCC = Σ các dự án. Tên NCC trong quyết toán không khớp Supplier nào → nhóm vào mục **"NCC chưa khớp"** (supplierId = null), không giấu số.

## File tạo / sửa
| File | Việc |
|------|------|
| `src/lib/debt.ts` | **MỚI** — `getReceivables()`, `getPayables()`, types, `norm()`. Logic dùng chung. |
| `src/lib/rbac.ts` | Thêm Resource `debt`; view: ADMIN+SALES+PROCUREMENT (không ENGINEERING); không edit. |
| `src/app/(app)/debts/page.tsx` | **MỚI** — trang Công nợ: thẻ tổng + 2 bảng. |
| `src/app/(app)/debts/DebtTables.tsx` | **MỚI** — client: 2 bảng, dòng bung chi tiết theo dự án. |
| `src/components/layout/Sidebar.tsx` | Thêm menu `/debts` "Công nợ" (icon HandCoins), resource `debt`. |
| `src/app/(app)/customers/page.tsx` + `CustomerManager.tsx` | Thêm cột "Còn phải thu" + dòng bung chi tiết dự án. |
| `src/app/(app)/suppliers/page.tsx` + `SupplierManager.tsx` | Thêm cột "Còn phải trả" + dòng bung chi tiết dự án. |
| `README.md`, `memory/project-qlda-web.md` | Cập nhật tài liệu. |

## Kiến trúc / data flow
- `debt.ts` chạy ở Server (import `db`). Trả mảng `CustomerDebt[]` / `SupplierDebt[]` đã gộp + tổng.
- Trang `/debts` (Server Component) gọi cả 2, render thẻ tổng + truyền xuống `DebtTables` (client, lo việc bung dòng).
- Trang customers/suppliers gọi `getReceivables()/getPayables()`, dựng `Map<id, …>` rồi nhúng vào Manager để hiện cột + chi tiết.

## Verification
1. `npx tsc --noEmit` EXIT 0.
2. `npm run dev`, đăng nhập admin → menu "Công nợ" hiện, mở `/debts`: thẻ tổng + 2 bảng có số.
3. Bấm 1 CĐT/NCC → bung chi tiết theo dự án; số cộng dồn khớp tổng dòng.
4. Trang Chủ đầu tư / Nhà cung cấp: có cột công nợ + bung chi tiết.
5. Đăng nhập role ENGINEERING (kythuat@cty.com) → KHÔNG thấy menu Công nợ, vào `/debts` bị chặn.
6. Đối chiếu 1 CĐT có quyết toán: còn phải thu khớp `CostSummary.receivable`.
