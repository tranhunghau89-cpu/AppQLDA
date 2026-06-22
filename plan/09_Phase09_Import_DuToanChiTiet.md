# Phase 09 — Import dự toán chi tiết từ 15 file Excel mẫu

## Mục tiêu
Nhập 15 file dự toán mẫu (mỗi file = 1 dự án, sheet `TongHop`) vào DB:
- Gắn vào dự án **đã có** khi tên khớp; **tạo mới** khi chưa có.
- Nhập **đầy đủ từng dòng vật tư** (KL/đơn giá/thành tiền/quy cách/ghi chú) vào `EstimateItem`.
- Cập nhật `area` (diện tích) và `salePrice` (giá bán) của dự án.
- Tổng chi phí & lợi nhuận do web tự tính từ các dòng item (không lưu cứng).

## Nguồn dữ liệu
- Thư mục `AppQLDA/DuToanMau/` (15 file, đã bỏ bản trùng `K25L47_PT(1)`).
- Mỗi file sheet `TongHop`:
  - **Phần đầu (hàng 1–7):** tổng hợp theo 5 nhóm cấu trúc A–E (Khung Mái, Vách, Canopy/Panel, Nóc Gió/Thang, Dầm Sàn). `Σ D3:D7` = diện tích m². `J1` = giá bán (có thể trống/stale). `I1` = tổng chi phí (STALE — không dùng).
  - **Phần chi tiết (từ hàng 9):** 3 cấp
    - Dòng **nhóm**: cột A = 1 chữ cái (A–E), B = "HẠNG MỤC …".
    - Dòng **mục**: cột A = số (1,2,3…), B = tên mục (Bulong neo, Kết cấu thép…).
    - Dòng **leaf** (vật tư): cột A trống, B = tên, C = đơn vị, D = KL, E = đơn giá, F = thành tiền, G = NCC, H = quy cách, I = ghi chú.

## Quy tắc đọc (đã kiểm chứng bằng prototype openpyxl)
- **Leaf** = (A trống) ∧ (B có tên) ∧ (F là số ≠ 0). Bỏ qua dòng nhóm (A=chữ) và dòng mục (A=số) vì là subtotal. Bỏ dòng F=0 (mẫu trống).
- **Tổng chi phí** = Σ F của các leaf (vì I1 và cả F header nhóm nhiều file bị stale → không tin được).
- **Diện tích** = Σ D3:D7.
- **Giá bán** = J1 nếu là số và `0 < J1 ≤ 10 × tổngChiPhí` (loại giá trị template/lỗi: PickLang 77 tỷ, K10L50/K20L30 1,89 tỷ trên dự toán rỗng).
- Lưu `nhóm cấu trúc` (Khung Mái/Vách/…) + `tên mục` vào `note` để giữ ngữ cảnh phân cấp.

## Map nhóm chi phí (`groupCode` ∈ ESTIMATE_GROUP)
Phân loại theo từ khoá trên (tên mục + tên leaf), ưu tiên tên leaf:
- "vận chuyển" → `VAN_CHUYEN`
- "lắp dựng/lắp đặt/lợp/nhân công" → `NHAN_CONG`
- "xà gồ" → `XA_GO`
- "neo / mã dưỡng" → `BL_NEO`
- "bulong/ty xà/liên kết" → `BLLK`
- "tôn/diềm/máng/ống/vít/keo/phụ kiện/phiểu" → `TON`
- "thép/kết cấu" → `KCT`
- "giằng/cáp/tăng đơ" → `VT_PHU`
- còn lại → `KHAC`
(Phân nhóm chỉ ảnh hưởng subtotal hiển thị; tổng chi phí luôn đúng vì cộng theo amount.)

## Quy tắc khớp dự án (an toàn, tránh gộp nhầm khác địa điểm)
1. **Khớp tên đầy đủ** (chuẩn hoá: trim, bỏ dấu, lowercase, bỏ khoảng trắng): `K25L78_BD`→N035, `K40L70_BD`→N036, `PickLang`↔`Pick Láng`.
2. **Khớp bare-dims**: lấy phần `K..L..` đầu tên file; chỉ khớp khi DB có dự án tên **đúng bằng** dims trần (vd file `K20L20_TQ` → dims `K20L20` → N044 tên "K20L20"). KHÔNG khớp khi DB chỉ có tên kèm hậu tố khác (vd `K104L45_GL` vs N041 "K104L45_BG" → khác địa điểm → tạo mới).
3. Không khớp → **tạo dự án mới**: code tự sinh `DT01…`, name = tên file đầy đủ.
- In bảng quyết định khớp/tạo-mới để người dùng kiểm tra.

## Idempotent
- Mỗi dự án đích: **xoá hết EstimateItem cũ rồi chèn mới** (chạy lại không nhân đôi).
- Cập nhật `area` luôn (file đáng tin); `salePrice` chỉ khi qua sanity check.
- Project mới: upsert theo name (chạy lại không tạo trùng).

## File tạo/sửa
- `scripts/import-estimates.ts` (mới) — ExcelJS + Prisma, đọc `../DuToanMau/*.xlsx`.
- `package.json` — thêm script `import:estimates`.

## Verification
1. `npm run import:estimates` chạy không lỗi; in bảng khớp + số item/dự án.
2. `npx prisma studio` / query: N044 có area=400, salePrice=280.000.000, ~13 item; tổng amount=192.559.551 (khớp K20L20_TQ).
3. Web `/estimates`: các dự án có tổng chi phí > 0, lợi nhuận hợp lý (không âm bất thường do giá bán stale).
4. Mở 1 dự án `/projects/{id}/estimate`: thấy dòng vật tư theo nhóm, đơn giá/KL khớp Excel.
5. Chạy lại script lần 2 → số item không đổi (idempotent).
