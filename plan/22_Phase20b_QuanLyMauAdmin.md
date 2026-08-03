# Phase 20b — Trình quản lý Mẫu dự toán (ADMIN)

> Ngày 2026-08-03. Nối tiếp Phase 20: model `EstimateTemplate`/`EstimateTemplateLine` đã có + seed 5 mẫu.
> Mục tiêu: ADMIN tạo/sửa/xóa/nhân bản mẫu qua UI (không phải sửa `seed-templates.ts`).

## Quyền
- Thêm resource `template` vào `rbac.ts` — **chỉ ADMIN** (`view`+`edit`). Trang + action gate bằng `requireView("template")` / `requirePermission("template","edit")`.
- Sidebar thêm mục "Mẫu dự toán" (lọc theo `can(role,"template","view")`) → chỉ ADMIN thấy.

## File
1. `src/lib/rbac.ts` — `Resource` thêm `"template"`; ADMIN matrix `template:["view","edit"]`.
2. `src/components/layout/Sidebar.tsx` — nav item `/estimate-templates` (icon LayoutTemplate, resource template).
3. `src/app/(app)/estimate-templates/page.tsx` — list (requireView template) + `_count.lines`.
4. `src/app/(app)/estimate-templates/TemplateList.tsx` (client) — nút "Tạo mẫu" (createTemplate→redirect), bảng mẫu: mở sửa, nhân bản, bật/tắt active, xóa.
5. `src/app/(app)/estimate-templates/actions.ts` — `createTemplate()→{ok,id}`, `saveTemplate(id,payload)` (update meta + **replace toàn bộ lines**), `deleteTemplate(id)`, `duplicateTemplate(id)`, `toggleTemplateActive(id,active)`. Tất cả `requirePermission("template","edit")`.
6. `src/app/(app)/estimate-templates/[templateId]/page.tsx` — load template+lines → editor.
7. `src/app/(app)/estimate-templates/[templateId]/TemplateEditor.tsx` (client) — meta (name/code/description/active) + bảng dòng sửa được.

## TemplateEditor — bảng dòng
Mỗi dòng: `groupLabel` (nhóm), `name`, `unit`, `defaultUnitPrice`, `role`(INPUT|DERIVED), tham số, `factor`, `groupCode`(select ESTIMATE_GROUP), `note`.
- role INPUT → ô `feedsParam` (tùy chọn); role DERIVED → ô `takesFromParam` + `factor`.
- `<datalist>` gợi ý các param key đang dùng trong mẫu (union feeds/takes) để gõ nhất quán.
- Thêm dòng / xóa dòng / lên–xuống (đổi sortOrder trong mảng client).
- "Lưu" → `saveTemplate(id, {meta, lines})`: server update meta, `deleteMany` lines cũ, `createMany` lines mới theo thứ tự (sortOrder=index).

## Data flow / lỗi
- payload lines: chuỗi số đơn giá parse bằng `parseViNumber`. role/groupCode validate; name+groupLabel bắt buộc mỗi dòng (bỏ dòng trống name).
- Xóa mẫu: chỉ ảnh hưởng mẫu (các `EstimateSection`/`EstimateItem` đã sinh KHÔNG bị đụng — `templateId` chỉ là tham chiếu mềm).
- Không transaction phức tạp: update + deleteMany + createMany tuần tự trong 1 action.

## Verification
1. `tsc --noEmit` + `next build` sạch.
2. Playwright (admin): mở "Mẫu dự toán" → thấy 5 mẫu; sửa 1 đơn giá + thêm 1 dòng → Lưu → mở lại đúng; nhân bản → có bản copy; xóa bản copy. Non-admin (kythuat) KHÔNG thấy mục nav + vào URL bị chặn.
3. Áp mẫu vừa sửa ở 1 dự án → số liệu dùng đơn giá mới.

## Ngoài phạm vi
- Kéo-thả sắp xếp (dùng nút lên/xuống).
- Quản lý param như thực thể riêng (param chỉ là chuỗi key).
