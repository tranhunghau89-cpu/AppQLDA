# Phase 10 — Module Hợp đồng & Báo giá (theo hạng mục)

## Mục tiêu
Thêm chức năng quản lý **Hợp đồng & Báo giá** theo từng hạng mục:
- Báo giá và hợp đồng **gộp 1 module** có trạng thái: Báo giá → Đã ký → Thanh lý.
- Mỗi hợp đồng gồm: thông tin (số HĐ, ngày, CĐT/Bên A, V/v), **các dòng hạng mục** (đơn giá bán × khối lượng = thành tiền), giá trị chưa VAT / VAT% / tổng có VAT, điều khoản thanh toán, **đường dẫn file HĐ đã ký**.
- Nhập sẵn 7 hợp đồng thật (đọc từ PDF scan bằng render ảnh + docx) + báo giá theo hạng mục cho 15 dự án (từ file dự toán).

## Nguồn dữ liệu hợp đồng (đã đọc)
7 hợp đồng (6 PDF scan + 1 docx) trong `XDDubai_DataCenter/2_DuAn/RaDonHang/...`:
| Dự án | Số HĐ | Ngày | Bên A | Chưa VAT | VAT8% → Tổng | Thanh toán |
|---|---|---|---|---|---|---|
| N047 K26L112 | 0704/2026/HĐMB 628-DUBAI | 07/04/2026 | Cty Tiến Phát 628 | 1.368.640.000 | 1.478.131.200 | 20/80 |
| N053 K17L27 | 0505/2026/HĐKT/THIENTRUC-DUBAI | 05/05/2026 | Chùa Thiên Trúc | 554.400.000 | 598.752.000 | 30/40/20/10 |
| N050 K16L20 | 1404/2026/HĐKT/TĐA-DUBAI | 14/04/2026 | Ông Trương Đình Anh | 550.543.000 | 594.586.440 | 30/50/20 |
| N048 K35L63 | 0904/2026/HĐMB/KAMA-DUBAI | 09/04/2026 | Cty KAMA | 926.100.000 | 1.000.188.000 | 20/60/20 |
| N049 PickLang | 1003/2026/HĐTC/HTX-DUBAI | 14/03/2026 | HTX Láng Hạ | 2.829.525.000 | 3.055.887.000 | 40/30/15/13+2 |
| N045 K21L34 | 3003/2026/HĐKT/PhuocAn-Dubai | 03/03/2026 | Cty Phước An | 678.300.000 | 732.564.000 | 20/50/20/10 |
| N051 K25L47 | 2104/2026/HĐKT/SONVIET-DUBAI | 21/04/2026 | Cty Sơn Việt | 1.042.200.000 | 1.125.576.000 | 30/30/20/17+3 |

**Báo giá theo hạng mục cho 15 dự án** lấy từ phần đầu sheet `TongHop` (hàng 3–7: nhóm A–E, diện tích D, đơn giá bán/m² cột J). Σ(D×J) = giá trị chưa VAT, **khớp 100%** với pre-VAT của hợp đồng (vd PickLang 2.829.525.000 thay vì J1=77 tỷ lỗi) → dùng làm `salePrice` đúng cho cả 5 dự án trước đây thiếu giá.

## Data model (Prisma)
```
model Contract {
  id, projectId(FK Cascade), contractNo?, signDate?, subject?,
  partyAName?, partyAInfo?, valueBeforeVat?, vatPercent?(=8), valueWithVat?,
  paymentTerms?, filePath?, status(QUOTE|SIGNED|LIQUIDATED, def QUOTE), note?,
  createdAt, updatedAt, items ContractItem[]
}
model ContractItem { id, contractId(FK Cascade), name, unit?, qty?, unitPrice?, amount?, sortOrder }
```
Project thêm quan hệ `contracts Contract[]`. (1 dự án có thể nhiều HĐ/phụ lục.)

## File tạo / sửa
- `prisma/schema.prisma` — thêm 2 model + quan hệ; migration `add_contract`.
- `src/lib/constants.ts` — `CONTRACT_STATUS` (Báo giá/Đã ký/Thanh lý).
- `src/lib/rbac.ts` — thêm resource `contract` (ADMIN/SALES edit, ENG/PROC view).
- `src/lib/contract.ts` — `computeContractTotals(items, vatPercent)` → {beforeVat, vat, withVat}.
- `scripts/import-contracts.ts` + `package.json` script `import:contracts`.
- `src/app/(app)/contracts/page.tsx` — danh sách HĐ toàn hệ thống (lọc trạng thái).
- `src/app/(app)/projects/[id]/contract/page.tsx` + `ContractEditor.tsx` + `actions.ts` — quản lý HĐ + dòng hạng mục theo dự án.
- `src/app/api/contracts/[id]/file/route.ts` — stream file HĐ từ ổ đĩa (server đọc filePath).
- `src/components/layout/Sidebar.tsx` — thêm nav "Hợp đồng & Báo giá".
- `src/app/(app)/projects/[id]/page.tsx` — thêm thẻ/link "Hợp đồng".

## RBAC
| Bộ phận | contract |
|---|---|
| ADMIN | Sửa |
| SALES (Kinh doanh/CĐT) | Sửa |
| ENGINEERING | Xem |
| PROCUREMENT | Xem |

## File mở từ web
filePath = đường dẫn tuyệt đối tới file gốc trên OneDrive. Web mở qua API route stream (server cùng máy, đọc fs theo đuôi pdf/docx). Không copy file.

## Idempotent import
- Match dự án: số HĐ→code đã biết (N0xx); báo giá→khớp tên/dims như import-estimates.
- Mỗi dự án: deleteMany Contract theo projectId rồi tạo lại (chạy lại không nhân đôi).
- Cập nhật `project.salePrice` = giá trị chưa VAT (HĐ nếu có, else báo giá Σ(D×J)).

## Verification
1. `npx prisma migrate dev` tạo bảng; `npm run import:contracts` chạy không lỗi, in bảng HĐ.
2. DB: N047 có HĐ số 0704..., 1 dòng hạng mục, valueBeforeVat=1.368.640.000, withVat=1.478.131.200.
3. salePrice PickLang(N049)=2.829.525.000 (hết lỗi 77 tỷ); dashboard lợi nhuận hết âm bất thường.
4. Web `/contracts`: liệt kê HĐ + trạng thái + giá trị + link file.
5. `/projects/{id}/contract`: sửa/thêm dòng hạng mục, đổi trạng thái, tổng VAT tự tính; mở được file HĐ.
6. RBAC: PROCUREMENT chỉ xem; SALES sửa được.
7. `npm run build` xanh; chạy lại import → không nhân đôi.
