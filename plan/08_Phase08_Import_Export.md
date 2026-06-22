# Phase 08 — Import từ Excel + Export báo cáo

## Mục tiêu
- Nhập dữ liệu thật từ TD_DA.xlsx (sheet TongHop: 56 dự án + CĐT + NCC).
- Xuất báo cáo Excel: danh sách dự án (kèm chi phí/LN) và dự toán 1 dự án.

## Import (scripts/import-excel.ts — chạy bằng `npm run import`)
- Đọc `../TD_DA.xlsx` (cùng thư mục AppQLDA) bằng ExcelJS.
- Sheet TongHop, từ dòng có mã N###:
  - A=mã, B=tình trạng (map text→status), C=tên, D=loại CT, E=CĐT, F=vị trí, G=ngày BĐ.
  - I=BL neo, J=KCT, K=Xà gồ, L=BLLK, M=Tôn, N=Lắp dựng → NCC theo hạng mục.
- Upsert project theo `code`; CĐT/NCC dedupe theo tên; ProjectSupplier upsert.
- Idempotent: chạy lại không nhân đôi.

## Export (ExcelJS trong route handler)
- `GET /api/export/projects` → xlsx danh sách dự án + tổng CP/giá bán/LN (gate quyền profit).
- `GET /api/export/estimate/[id]` → xlsx dự toán 1 dự án theo nhóm.
- Nút "Xuất Excel" ở /projects, /estimates và trang dự toán.

## Verification
1. `npm run import` → DB có ~56 dự án; `/projects` hiển thị đủ; trạng thái map đúng.
2. Tải `/api/export/projects` → mở file Excel thấy danh sách + cột chi phí/LN.
3. Tải `/api/export/estimate/[N037]` → thấy bảng dự toán theo nhóm.
4. `npm run build` không lỗi.
