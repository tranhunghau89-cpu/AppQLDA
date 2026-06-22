# Phase 01 — Mô hình dữ liệu đầy đủ (Prisma schema + seed)

## Mục tiêu
Định nghĩa toàn bộ bảng dữ liệu ánh xạ từ 2 file Excel, migration, và seed dữ liệu mẫu để các module sau có dữ liệu hiển thị.

## Bảng (models)
- **User** (đã có Phase 00)
- **Customer** — CĐT/Khách hàng: name, contactPerson, phone, address, note.
- **Supplier** — NCC: name, category (`KCT|XA_GO|TON|BL_NEO|BLLK|LAP_DUNG|KHAC`), contactPerson, phone, note.
- **Project** — code (unique, N037), name (K25L60), buildingType, status (`CHO|SHOP|GIA_CONG|LAP_DUNG|HOAN_THANH`), location, customerId?, startDate?, endDate?, kK/kL/kH (kích thước), area (m²), salePrice, note.
- **ProjectSupplier** — projectId + supplierId + component (1 NCC theo từng hạng mục; cột I–N ở TongHop). Unique(projectId, component).
- **Milestone** — projectId + type (`BV_KT|SHOP|MUA_HANG|GIA_CONG|LAP_DUNG|LOP_TON|HS_NT|HS_QT`) + planDate?/actualDate?/done/note. Unique(projectId, type).
- **WeeklyLog** — projectId + year + week + statusSnapshot? + note. Unique(projectId, year, week).
- **EstimateItem** — projectId + groupCode (`KCT|XA_GO|TON|BL_NEO|BLLK|VT_PHU|NHAN_CONG|VAN_CHUYEN|MAY|KHAC`) + name + unit? + designQty?/actualQty?/unitPrice?/amount? + supplierId? + orderStatus?/dispatchStatus? + note + sortOrder.

Tất cả "enum" lưu dạng String (SQLite). Hằng số + nhãn tiếng Việt + thứ tự hiển thị ở `src/lib/constants.ts`.

## File tạo/sửa
- `prisma/schema.prisma` — thêm 7 model + quan hệ; onDelete: Cascade cho con của Project.
- `src/lib/constants.ts` — STATUS, SUPPLIER_CATEGORY, MILESTONE_TYPE, ESTIMATE_GROUP (value→label→order→tone).
- `prisma/seed.ts` — thêm seed: vài Customer, Supplier theo loại, 3–4 Project mẫu (lấy từ N037/K20L20), milestones, 1 EstimateItem set, weekly logs.

## Verification
1. `npx prisma migrate dev` chạy sạch, không lỗi.
2. `npm run db:seed` chèn dữ liệu mẫu thành công.
3. `npx prisma studio` thấy đủ bảng + dữ liệu mẫu.
4. `npm run build` không lỗi TypeScript.
