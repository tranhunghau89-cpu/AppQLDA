# Phase 20 — Dự toán theo Mẫu hạng mục (template + tự tính)

> Ngày 2026-08-03. Brainstorming đã chốt: mẫu **lưu DB (admin sửa được)** + **tự tính đầy đủ** + **có cấp Hạng mục**.
> Giá trị: chọn mẫu (Khung mái/Vách/Canopy/Nóc gió/Dầm sàn) → điền vài ô "đỏ" → sinh toàn bộ dòng dự toán, số lượng & thành tiền tự tính.

## Cấu trúc 3 cấp
`Hạng mục (Section)` → `Nhóm (groupLabel)` → `Dòng (line)`. App cũ chỉ có 1 cấp `groupCode` (KCT/TON…) → thêm `sectionId` + `groupLabel` vào `EstimateItem`. `groupCode` giữ nguyên cho bảng "Chi phí & lợi nhuận theo nhóm".

## Cơ chế tự tính — "tham số cộng dồn" (không cần công thức Excel)
- Dòng vai trò **INPUT**: user nhập KL; có thể `feedsParam` (nạp KL vào 1 tham số).
- Dòng vai trò **DERIVED**: KL = `param[takesFromParam] × factor` (factor mặc định 1).
- Thành tiền = KL × đơn giá ở mọi dòng.
- Engine 1 pass: gom param từ mọi dòng INPUT → tính KL dòng DERIVED. (Không có derived-of-derived.)
- Tham số theo từng mẫu: Khung mái/Vách/Canopy/Nóc gió dùng `KCT_KG`,`TON_M2`; Dầm sàn dùng `KCT_KG`,`DECK_M2`,`DINH_BO`.

## Model mới (Prisma)
- `EstimateTemplate { id, name, code?, description?, sortOrder, active, lines[] }`
- `EstimateTemplateLine { id, templateId→Cascade, groupLabel, name, unit?, defaultUnitPrice?, role(INPUT|DERIVED), feedsParam?, takesFromParam?, factor?=1, defaultQty?, groupCode, note?, sortOrder }`
- `EstimateSection { id, projectId→Cascade, name, code?, templateId?, sortOrder, createdAt, items[] }`
- `EstimateItem` **+** `sectionId?` (`section EstimateSection? onDelete Cascade`) **+** `groupLabel?`
- `Project` **+** `estimateSections EstimateSection[]`
- Migration `add_estimate_template` — cộng thêm bảng + cột nullable, KHÔNG mất dữ liệu cũ (item cũ `sectionId=null` → gom "Chưa phân hạng mục").

## File
1. `prisma/schema.prisma` — 3 model mới + 2 cột.
2. `src/lib/estimateTemplate.ts` — engine thuần `computeTemplateLines(lines, inputByLineId)` (client + server dùng chung) + types.
3. `prisma/seed-templates.ts` + script `db:seed:templates` — seed 5 mẫu (cấu trúc/đơn giá/role/param/groupLabel/groupCode lấy từ ảnh mẫu user gửi). Idempotent (xóa mẫu cùng code rồi tạo lại).
4. `src/app/(app)/projects/[id]/estimate/actions.ts` — thêm `applyEstimateTemplate(projectId, payload)` + `deleteEstimateSection(projectId, sectionId)` (requirePermission estimate:edit).
5. `src/app/(app)/projects/[id]/estimate/ApplyTemplate.tsx` (client) — chọn mẫu + tên hạng mục + bảng nhập (KL sửa ở dòng INPUT, DERIVED readonly tự tính; đơn giá sửa mọi dòng, prefill) + xem trước realtime + submit. Bỏ qua dòng KL trống/0 khi tạo.
6. `src/app/(app)/projects/[id]/estimate/EstimateEditor.tsx` — gom **Section → groupLabel**; subtotal mỗi hạng mục + tổng dự án; nút "Thêm hạng mục từ mẫu"; xóa cả hạng mục. Item cũ (section null) → "Chưa phân hạng mục".
7. `src/app/(app)/projects/[id]/estimate/page.tsx` — fetch templates (active) + sections + items(kèm sectionId, groupLabel); truyền vào editor.

## Data flow
Client `ApplyTemplate` gửi `{ templateId, sectionName, lines:[{lineId, qty, unitPrice}] }` → server load template lines → build inputMap từ qty (chỉ dòng INPUT) → `computeTemplateLines` (chuẩn ở server) → tạo `EstimateSection` + `EstimateItem` (bỏ dòng qty null/0) → `revalidatePath`.

## Seed 5 mẫu (tóm tắt param)
| Mẫu | feedsParam | DERIVED lấy |
|---|---|---|
| A Khung mái | KCT_KG=Thép tổ hợp+Thép hình+Xà gồ; TON_M2=Tôn mái | VC/Lắp dựng KCT←KCT_KG; VC tôn/Lợp tôn←TON_M2 |
| B Vách | KCT_KG=Xà gồ; TON_M2=Tôn thường+Tôn nhựa | như trên (Lợp tôn 30k) |
| C Canopy | KCT_KG=Thép tổ hợp+Xà gồ; TON_M2=Tôn vòm+Tôn thẳng | như trên |
| D Nóc gió | KCT_KG=Thép hình+Xà gồ; TON_M2=Tôn vòm+Tôn thẳng | như trên (Lắp phụ kiện 25k) |
| E Dầm sàn | KCT_KG=Thép tổ hợp+Thép hình; DECK_M2=Tôn Decking; DINH_BO=Đinh chống cắt | VC/Lắp dựng KCT←KCT_KG; VC tôn/Lợp tôn←DECK_M2; Bắn đinh chống cắt←DINH_BO |

## Verification
1. `npx tsc --noEmit` sạch; `next build` OK.
2. Migration + seed áp Supabase; kiểm 5 template có đúng số dòng.
3. Playwright: dự án DEMO1 → Dự toán → "Thêm hạng mục từ mẫu" → Khung mái → nhập Thép tổ hợp/Thép hình/Xà gồ + Tôn mái → xem trước: VC KCT/Lắp dựng KCT = tổng kg thép, VC tôn/Lợp tôn = m2 tôn, thành tiền đúng → lưu → bảng hiện hạng mục "Khung mái" gom theo nhóm + tổng; profit cập nhật → xóa dữ liệu test.
4. Item cũ vẫn hiện ("Chưa phân hạng mục").

## Ngoài phạm vi (Phase 2)
- Trình quản lý mẫu ADMIN (CRUD template/line/param, sắp xếp). Phase 1 sửa đơn giá ngay trong form áp mẫu là đủ.
- Export Excel theo cấu trúc hạng mục (giữ export hiện tại).
