# Phase 19 — Cơ chế Nhập nhanh (Quick-Add) + Scope theo vai trò × dự án

> Spec thiết kế (brainstorming đã chốt). Ngày: 2026-08-03.
> Mục tiêu: ai cũng nhập nhanh dữ liệu **trong phạm vi của mình** (vai trò × dự án được giao), cả mobile hiện trường lẫn desktop văn phòng.

## Quyết định đã chốt (qua hỏi đáp)
- Người dùng: **cả hai** — NV công trường (điện thoại) + NV văn phòng (desktop).
- Loại dữ liệu: **cả 4** — Tiến độ/nhật ký, Đơn hàng/vật tư, Chi phí/Thanh toán, Dự toán/khối lượng.
- Phạm vi: **vai trò × dự án được giao** (cần thêm gán người↔dự án).
- Cơ chế (gọn lại): **Quick-Add hub** (gộp "nút nhập nhanh" + "ảnh/ghi chú mobile") + **Dán từ Excel** (gộp mục "nhập inline"; inline để sau).
- Phương án: **① Hub hợp nhất**, chia Phase A/B/C.

## Ánh xạ loại dữ liệu → model có sẵn
| Loại | Model | Ảnh |
|---|---|---|
| Tiến độ/nhật ký | `ProjectNote` | `NoteImage` (Bytes) |
| Đơn hàng/vật tư | `PurchaseOrder` + `PurchaseOrderItem` | (— / PoItemImage sau) |
| Chi phí/Thanh toán | `Payment` | ảnh chứng từ (Bytes, nếu có field) |
| Dự toán/khối lượng | `EstimateItem` | — |

## Phase A — Nền tảng scope (vai trò × dự án)
- **Model mới** `ProjectMember { id, projectId, userId, createdAt, @@unique([projectId,userId]) }`.
  - `Project.members ProjectMember[]`, `User.projectMemberships ProjectMember[]`, onDelete Cascade.
  - Migration `add_project_member`.
- **`src/lib/scope.ts`**: `myProjectIds(session): Promise<string[] | "ALL">`
  - `ADMIN` → `"ALL"`; vai trò khác → id các dự án được gán.
  - Helper `canAccessProject(session, projectId)` + `scopedProjectWhere(session)` (trả `{}` hoặc `{ id: { in: ids } }`) dùng chung.
- **UI gán thành viên (ADMIN)**: khối "Thành viên dự án" trong `projects/[id]/page.tsx` — list + thêm (chọn user) + xóa. Server actions `addProjectMember` / `removeProjectMember` (requirePermission project:edit, chỉ ADMIN).
- Quick-Add dùng scope ngay; danh sách các module sẽ lọc scope dần (không bắt buộc trong phase này — ghi rõ để tránh "lọc ngầm" thiếu nhất quán).

## Phase B — Quick-Add hub (lõi, mobile-first)
- **Nút "＋ Nhập nhanh"** cố định ở header (component `QuickAddButton` trong TopBar), hiện mọi trang. Trên mobile là FAB tròn góc dưới phải; desktop là nút trong header.
- **`QuickAddSheet`** (client): bottom-sheet mobile / modal desktop, 3 bước:
  1. **Chọn dự án** — dropdown `myProjects` (nếu chỉ 1 → tự chọn, ẩn bước).
  2. **Chọn loại** — chips, chỉ hiện loại mà vai trò được `edit` (map: Tiến độ→`progress`; Đơn hàng→`purchase`; Chi phí/Thanh toán→`cost`; Dự toán→`estimate`).
  3. **Form ngắn 1 màn hình** theo loại (dưới).
- **4 form ngắn** (mỗi form 1 file trong `src/app/(app)/quick/forms/`):
  - `TienDoForm`: ghi chú (bắt buộc) + % (optional) + input ảnh `capture=environment` (nhiều ảnh) → `ProjectNote`(+`NoteImage`).
  - `DonHangForm`: NCC (select) + n dòng {tên, ĐV, SL, đơn giá} với "＋ thêm dòng" → `PurchaseOrder`(status DRAFT)+items; value=Σ.
  - `ChiPhiForm`: loại thu/chi + số tiền + ngày + ghi chú + ảnh chứng từ → `Payment`.
  - `DuToanForm`: nhóm (select ESTIMATE_GROUP) + hạng mục + ĐV + KL + đơn giá → `EstimateItem` (amount=KL×đơn giá).
- **Server actions** `src/app/(app)/quick/actions.ts`: mỗi loại 1 action, đều:
  - `requirePermission(role, <resource>, "edit")` + kiểm tra `canAccessProject(session, projectId)` → nếu sai trả lỗi.
  - Tạo bản ghi, `revalidatePath` trang liên quan.
- **UX "nhập tiếp"**: submit xong → toast "Đã lưu", giữ dự án+loại, reset field → nhập tiếp ngay (đếm số đã nhập trong phiên).

## Phase C — Dán từ Excel (desktop)
- Component dùng chung **`PasteTable`**: textarea "Dán từ Excel" → tách theo `\n` (dòng) và `\t` (cột) → map cột theo cấu hình từng loại → bảng xem trước **sửa được** (xóa dòng lỗi) → "Xác nhận nhập N dòng".
- Áp cho 3 loại bảng: Đơn hàng (dòng vật tư), Dự toán (item), Chi phí (dòng). Mỗi loại 1 config cột + 1 bulk server action (tạo hàng loạt trong 1 transaction; vẫn kiểm scope).
- Hiện trong `QuickAddSheet` (tab "Dán bảng") khi ở desktop; ẩn trên mobile.

## Data flow / lỗi / test
- Client form → server action (zod validate + scope check) → Prisma create → `revalidatePath`.
- Ảnh: đọc `File.arrayBuffer()` → `Uint8Array` lưu Bytes (như `NoteImage`/`PoItemImage` hiện có); giới hạn ~10MB/ảnh.
- Lỗi scope/permission → thông báo thân thiện tiếng Việt, không lộ chi tiết.
- **Ngoài phạm vi**: nhập offline (mobile mất mạng), inline-grid, import file đính kèm hàng loạt.
- **Test (Playwright)**: tạo user non-admin (vd kythuat@), gán vào 1 dự án; đăng nhập → mở Quick-Add → thấy đúng loại theo vai trò + chỉ dự án được giao → nhập mỗi loại → kiểm tra bản ghi tạo đúng + không truy cập được dự án ngoài phạm vi.

## Mặc định đã chốt
- `ProjectMember` đơn giản (không phân quyền trong dự án).
- Ảnh lưu DB (Bytes) như hiện tại (chưa đẩy Storage).
- ACCOUNTING scope theo dự án được giao như các vai trò khác.

## Verification
1. `npx tsc --noEmit` (chỉ src) sạch; `next build` OK.
2. Migration `add_project_member` áp lên Supabase.
3. Playwright: luồng gán thành viên + nhập nhanh 4 loại + chặn scope.
4. Kiểm tra mobile (resize) FAB + bottom-sheet + chụp ảnh.
