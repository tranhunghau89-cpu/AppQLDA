# QC theo giai đoạn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (người dùng chọn làm trực tiếp). Steps dùng checkbox (`- [ ]`).

**Goal:** Danh mục QC theo 8 giai đoạn, giao theo bộ phận, đánh kết quả có lịch sử + bằng chứng, trang "Việc QC", bộ mẫu do ADMIN quản lý, và cờ QC trong bảng thông tin dự án.

**Architecture:** Luật (quyền đánh, đếm, cờ, sắp xếp, kiểm tra đầu vào) nằm trong hàm thuần `src/lib/qc.ts` có vitest. Server actions kiểm quyền và ghi Prisma. `tinhCo` của phần 1 nhận thêm dữ liệu QC qua `HealthInput.qc`.

**Tech Stack:** Next.js 16 app router, React 19, Prisma/Postgres (PGlite cục bộ), Tailwind, vitest, zod.

**Spec:** `plan/11_QcGiaiDoan_design.md`

## Global Constraints

- Giai đoạn = `MILESTONE_TYPE`; bộ phận = `ROLES` (`src/lib/rbac.ts`).
- Kết quả: `CHUA | DAT | KHONG_DAT | KHONG_AP_DUNG`; `KHONG_DAT` bắt buộc ghi chú.
- Đánh kết quả: `role === boPhan || role === "ADMIN"` và xem được dự án (`canAccessProject`).
- Bằng chứng: ảnh hoặc PDF, ≤ 5 tệp / lần, ≤ 10 MB / tệp; kho chưa cấu hình → ẩn ô đính kèm.
- Ngưỡng VÀNG = `NGUONG_SAP_DEN_HAN` (7) của `projectHealth.ts`; "hôm nay" theo giờ VN (`soNgay`).
- QC chỉ cảnh báo, không chặn chuyển giai đoạn.
- Lý do QC không ẩn với vai không xem tiền; bảng so sánh vật tư không hiện giá.
- Client component không gọi `router.refresh()` — dựa vào `revalidatePath`; xác nhận dùng `useConfirm`.
- Chỉ `git add` đúng file; không `git add -A`. Commit cục bộ trên `master`, không push.

## Review Focus

1. Vai sai bộ phận gọi thẳng server action đánh kết quả → bị từ chối (không chỉ ẩn nút). (Test `duocDanhQc` ở Task 2 + kiểm ở action Task 4.)
2. Dự án chưa tạo danh mục QC → không cờ QC, khối QC hiện nút tạo, `/qc` không lỗi. (Task 3 test.)
3. Bấm "Tạo danh mục từ mẫu" hai lần (double-click / hai tab) → không nhân đôi mục. (Task 4: kiểm `count > 0` trong transaction.)
4. Tệp sai loại / quá 10 MB / quá 5 tệp → báo lỗi, không ghi lần kiểm dở dang. (Task 4: kiểm tra trước khi ghi.)
5. Mốc giai đoạn đã `done` nhưng còn mục `CHUA` → không VÀNG; còn `KHONG_DAT` → vẫn ĐỎ. (Task 2 test.)

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261012110000_qc_giai_doan/migration.sql` | 4 bảng QC + 30 mục mẫu |
| `src/lib/constants.ts` | `QC_KET_QUA`, `QC_LOAI` (+MAP) |
| `src/lib/qc.ts` (+`.test.ts`) | `duocDanhQc`, `kiemTraDanhGia`, `tomTatGiaiDoan`, `lyDoQc`, `sapXepViecQc` |
| `src/lib/projectHealth.ts` (+test) | `HealthInput.qc?`, `LyDo.loai` thêm `"QC"`, gọi `lyDoQc` |
| `src/lib/audit.ts` | nhãn `QcMau` |
| `src/app/(app)/projects/[id]/qcActions.ts` | tạo từ mẫu, thêm/sửa/xoá mục, đánh kết quả (FormData) |
| `src/app/(app)/projects/[id]/QcPanel.tsx` | khối QC (client) |
| `src/app/(app)/projects/[id]/QcSoSanhVatTu.tsx` | bảng so sánh (client, dữ liệu từ server qua props) |
| `src/app/(app)/projects/[id]/page.tsx` | truy vấn QC + so sánh, gắn khối `id="qc"`, truyền `qc` vào `tinhCo` |
| `src/app/(app)/projects/tong-quan/page.tsx` | truyền `qc` vào `tinhCo` |
| `src/app/(app)/qc/page.tsx`, `BangViecQc.tsx` | Việc QC của tôi |
| `src/app/(app)/qc-mau/page.tsx`, `QcMauEditor.tsx`, `actions.ts` | bộ mẫu (ADMIN) |
| `src/components/layout/Sidebar.tsx` | "Việc QC", "Mẫu QC" (ADMIN) |

---

### Task 1: Schema, migration, bộ mẫu gợi ý

**Files:** `prisma/schema.prisma`, migration `20261012110000_qc_giai_doan`.

- [ ] Thêm 4 model đúng như spec mục "Dữ liệu" (`QcMau`, `QcMuc`, `QcLanKiem`, `QcTep`) và `qcMuc QcMuc[]` vào `Project`.
- [ ] Migration SQL: `CREATE TABLE` + index + FK cascade cho 4 bảng (theo đúng kiểu của migration `20261012100000`), rồi `INSERT INTO "QcMau" ("id","giaiDoan","noiDung","boPhan","loai","thuTu","active","updatedAt") VALUES ('qcmau_01','BV_KT','Hồ sơ thiết kế đủ: mặt bằng, mặt đứng, mặt cắt, kết cấu móng, khung','ENGINEERING','THUONG',1,true,CURRENT_TIMESTAMP), …` cho đủ 30 mục của spec (mục (*) → `DOI_CHIEU_VAT_TU`; KT→ENGINEERING, VT→PROCUREMENT, KD→SALES, KTo→ACCOUNTING, BGĐ→ADMIN; `thuTu` = số thứ tự trong spec) kèm `ON CONFLICT ("id") DO NOTHING`.
- [ ] Verify: `npx prisma validate`, `npx prisma generate`, `npm run typecheck`; áp migration lên PGlite cục bộ bằng `db.exec` (không dùng `prisma migrate deploy` — `.env` trỏ production) và đếm `SELECT count(*) FROM "QcMau"` = 30.
- [ ] Commit `feat(qc): bảng QC và bộ mẫu gợi ý 30 mục`.

### Task 2: `src/lib/qc.ts` — luật thuần

**Interfaces (Produces):**

```ts
export type KetQuaQc = "CHUA" | "DAT" | "KHONG_DAT" | "KHONG_AP_DUNG";
export interface QcMucLite { giaiDoan: string; ketQua: string }
export function duocDanhQc(role: string, boPhan: string): boolean;
export function kiemTraDanhGia(v: { ketQua: string; ghiChu: string }): string | null; // null = hợp lệ, chuỗi = lỗi
export function tomTatGiaiDoan(muc: QcMucLite[]): { dat: number; tong: number; khongDat: number; chua: number }; // tong bỏ KHONG_AP_DUNG
export function lyDoQc(muc: QcMucLite[], milestones: { type: string; planDate: Date | null; done: boolean }[], nowMs: number): LyDo[];
export function sapXepViecQc<T extends { ketQua: string; han: Date | null }>(a: T, b: T): number;
```

**Tests (`src/lib/qc.test.ts`) — viết trước, chạy thấy FAIL:**

```ts
import { describe, expect, it } from "vitest";
import { duocDanhQc, kiemTraDanhGia, lyDoQc, sapXepViecQc, tomTatGiaiDoan } from "./qc";

const NOW = Date.parse("2026-10-12T02:00:00Z");
const vn = (s: string) => new Date(`${s}T00:00:00+07:00`);

describe("duocDanhQc", () => {
  it("đúng bộ phận hoặc ADMIN", () => {
    expect(duocDanhQc("ENGINEERING", "ENGINEERING")).toBe(true);
    expect(duocDanhQc("ADMIN", "PROCUREMENT")).toBe(true);
    expect(duocDanhQc("SALES", "ENGINEERING")).toBe(false);
  });
});

describe("kiemTraDanhGia", () => {
  it("KHONG_DAT bắt buộc ghi chú", () => {
    expect(kiemTraDanhGia({ ketQua: "KHONG_DAT", ghiChu: "  " })).toMatch(/ghi chú/i);
    expect(kiemTraDanhGia({ ketQua: "KHONG_DAT", ghiChu: "Sai màu" })).toBeNull();
  });
  it("kết quả lạ bị từ chối; CHUA không được đánh", () => {
    expect(kiemTraDanhGia({ ketQua: "XYZ", ghiChu: "" })).not.toBeNull();
    expect(kiemTraDanhGia({ ketQua: "CHUA", ghiChu: "" })).not.toBeNull();
    expect(kiemTraDanhGia({ ketQua: "DAT", ghiChu: "" })).toBeNull();
  });
});

describe("tomTatGiaiDoan", () => {
  it("bỏ KHONG_AP_DUNG khỏi tổng", () => {
    const r = tomTatGiaiDoan(["DAT", "KHONG_AP_DUNG", "CHUA", "KHONG_DAT"].map((k) => ({ giaiDoan: "SHOP", ketQua: k })));
    expect(r).toEqual({ dat: 1, tong: 3, khongDat: 1, chua: 1 });
  });
});

describe("lyDoQc", () => {
  const m = (giaiDoan: string, ketQua: string) => ({ giaiDoan, ketQua });
  it("không có mục → không lý do", () => expect(lyDoQc([], [], NOW)).toEqual([]));
  it("KHONG_DAT → ĐỎ kể cả khi mốc đã xong", () => {
    const r = lyDoQc([m("GIA_CONG", "KHONG_DAT")], [{ type: "GIA_CONG", planDate: null, done: true }], NOW);
    expect(r).toEqual([{ muc: "DO", loai: "QC", soNgay: 1, text: "QC Gia công: 1 mục không đạt" }]);
  });
  it("CHUA + mốc trong 7 ngày (hoặc quá hạn) → VÀNG; 8 ngày / không hạn / đã xong → không", () => {
    const chua = [m("LAP_DUNG", "CHUA"), m("LAP_DUNG", "CHUA"), m("LAP_DUNG", "DAT")];
    const mk = (planDate: Date | null, done = false) => [{ type: "LAP_DUNG", planDate, done }];
    expect(lyDoQc(chua, mk(vn("2026-10-19")), NOW)[0]).toMatchObject({ muc: "VANG", text: "QC Lắp dựng còn 2 mục chưa kiểm" });
    expect(lyDoQc(chua, mk(vn("2026-10-01")), NOW)[0]?.muc).toBe("VANG");
    expect(lyDoQc(chua, mk(vn("2026-10-20")), NOW)).toEqual([]);
    expect(lyDoQc(chua, mk(null), NOW)).toEqual([]);
    expect(lyDoQc(chua, mk(vn("2026-10-14"), true), NOW)).toEqual([]);
  });
});

describe("sapXepViecQc", () => {
  it("KHONG_DAT trước, rồi hạn tăng dần, không hạn cuối", () => {
    const rows = [
      { id: "a", ketQua: "CHUA", han: null },
      { id: "b", ketQua: "CHUA", han: vn("2026-10-20") },
      { id: "c", ketQua: "KHONG_DAT", han: null },
      { id: "d", ketQua: "CHUA", han: vn("2026-10-13") },
    ];
    expect(rows.sort(sapXepViecQc).map((r) => r.id)).toEqual(["c", "d", "b", "a"]);
  });
});
```

- [ ] Thêm `QC_KET_QUA` (CHUA "Chưa kiểm" slate, DAT "Đạt" green, KHONG_DAT "Không đạt" red, KHONG_AP_DUNG "Không áp dụng" slate) và `QC_LOAI` (THUONG "Thường", DOI_CHIEU_VAT_TU "Đối chiếu vật tư") vào `constants.ts`.
- [ ] Cài đặt `qc.ts` (import `LyDo`, `NGUONG_SAP_DEN_HAN`, `soNgay` từ `projectHealth`; nhãn giai đoạn từ `MILESTONE_TYPE_MAP`). Mỗi giai đoạn tối đa một lý do ĐỎ và một lý do VÀNG; ĐỎ `soNgay` = số mục không đạt, VÀNG `soNgay` = số ngày còn lại (âm → 0).
- [ ] Verify: vitest `src/lib/qc.test.ts` PASS, typecheck.
- [ ] Commit `feat(qc): luật QC thuần`.

**Lưu ý vòng import:** `qc.ts` import `projectHealth.ts`; Task 3 làm `projectHealth.ts` import `lyDoQc` từ `qc.ts`. Để tránh vòng, đặt `lyDoQc` vào **`projectHealth.ts`**? Không — giải: `qc.ts` chỉ import *type* `LyDo` (`import type`) và lấy `soNgay`/`NGUONG` từ một module nhỏ mới `src/lib/ngayVN.ts` (chuyển `dauNgayVN`, `soNgay`, `NGUONG_SAP_DEN_HAN` sang đó, `projectHealth.ts` re-export). Làm việc tách này ở đầu Task 2.

### Task 3: Cờ QC trong `tinhCo`

- [ ] Test trước (`projectHealth.test.ts`): `tinhCo(input({ qc: [{ giaiDoan: "SHOP", ketQua: "KHONG_DAT" }] }), NOW)` → `muc: "DO"`, có lý do `loai: "QC"`; `qc` undefined → như cũ; lý do QC vẫn có khi `anTien: true`.
- [ ] `HealthInput` thêm `qc?: { giaiDoan: string; ketQua: string }[]`; `LyDo.loai` thêm `"QC"`; `tinhCo` nối `lyDoQc(d.qc ?? [], d.milestones, nowMs)` trước khi sắp xếp.
- [ ] `projects/[id]/page.tsx` và `projects/tong-quan/page.tsx`: select thêm `qcMuc: { select: { giaiDoan: true, ketQua: true } }` và truyền `qc: project.qcMuc`.
- [ ] Verify: vitest toàn bộ, typecheck. Commit `feat(qc): cờ QC trong bảng thông tin dự án`.

### Task 4: Khối QC trong trang dự án

**`qcActions.ts` (`"use server"`)** — mọi hàm trả `ActionResult` từ `../actions`:
- `taoQcTuMau(projectId)`: `denyProject("project","edit",…)`; trong `db.$transaction(async tx => …)`: nếu `tx.qcMuc.count({where:{projectId}}) > 0` → `{ok:false,error:"Dự án đã có danh mục QC."}`; đọc `QcMau` active theo `giaiDoan, thuTu`; `createMany`.
- `luuQcMuc(projectId, v: { id?: string; giaiDoan: string; noiDung: string; boPhan: string; loai: string })`: `denyProject` edit; validate giai đoạn ∈ `MILESTONE_TYPE_MAP`, bộ phận ∈ `ROLES`, loại ∈ `QC_LOAI_MAP`, nội dung không rỗng; sửa bằng `updateMany({where:{id,projectId}})`; thêm với `thuTu = max+1` của giai đoạn.
- `xoaQcMuc(projectId, id)`: `denyProject` edit; `deleteMany({where:{id,projectId}})`.
- `danhGiaQc(projectId, mucId, form: FormData)`: `requireSession`; `canAccessProject` (sai → lỗi); đọc mục theo `{id: mucId, projectId}`; `duocDanhQc(session.role, muc.boPhan)` sai → `"Mục này thuộc bộ phận khác."`; `kiemTraDanhGia`; tệp `form.getAll("tep")` lọc `File` size>0: ≤5, mỗi tệp `image/*` hoặc `application/pdf`, ≤10MB, có tệp mà `!isStorageConfigured()` → lỗi — **kiểm hết trước khi ghi**. Ghi: tạo `QcLanKiem` (nguoiId/Ten/Vai từ session), cập nhật `QcMuc` (ketQua, nguoiKiem, ngayKiem=now, ghiChu), rồi upload từng tệp key `qc/${projectId}/${lanKiem.id}/${Date.now()}-${safe}` và tạo `QcTep`. `revalidatePath(/projects/${projectId})`, `revalidatePath("/qc")`.

**`page.tsx`:** truy vấn thêm (song song) `db.qcMuc.findMany({ where:{projectId:id}, orderBy:[{giaiDoan:"asc"},{thuTu:"asc"}], include:{ lanKiem:{ orderBy:{createdAt:"desc"}, include:{tep:true} } } })`; ký `signedUrl` cho tệp; dữ liệu so sánh: `project.materialSpecs`, 4 trường màu, và `db.purchaseOrderItem.findMany({ where:{ order:{ projectId:id } }, select:{ name, category, groupName, unit, qty, weight, note, order:{select:{orderNo,category,supplier:{select:{name}}}} } })` chỉ khi dự án có mục loại `DOI_CHIEU_VAT_TU`. Khối `<section id="qc" className="scroll-mt-20">` đặt ngay sau khối "Tiến độ thực hiện".

**`QcPanel.tsx`** props: `{ projectId; muc: QcMucView[]; milestones: Record<string,{planDate:string|null;done:boolean}>; role: Role; canEdit: boolean; coKho: boolean; soSanh: SoSanhData | null }`.
- Rỗng → thông báo + nút "Tạo danh mục QC từ mẫu" (khi `canEdit`).
- Thẻ theo 8 giai đoạn (bỏ giai đoạn không có mục), đầu thẻ: tên, "đạt x/n", badge đỏ nếu có không đạt.
- Dòng mục: nội dung, badge bộ phận (`ROLE_LABEL`), badge kết quả (`QC_KET_QUA_MAP`), "người · thời điểm", ghi chú, tệp (link mở tab mới), nút "Đánh giá" (khi `duocDanhQc(role, boPhan)`), "So sánh" (loại đối chiếu), "Lịch sử (k)" (mở danh sách lần kiểm), sửa/xoá (khi `canEdit`, xoá qua `useConfirm`).
- Form đánh giá: 3 nút chọn Đạt/Không đạt/Không áp dụng, `Textarea` ghi chú (đánh dấu bắt buộc khi Không đạt), `input type=file multiple accept="image/*,application/pdf"` (khi `coKho`), Lưu → `danhGiaQc(projectId, id, new FormData(form))`.
- Form thêm mục cuối mỗi thẻ (khi `canEdit`): nội dung, bộ phận, loại.

**`QcSoSanhVatTu.tsx`**: hai cột như spec (trái: màu + chủng loại; phải: dòng đơn hàng nhóm theo đơn). Không có dữ liệu bên nào → "Chưa có …".

- [ ] Verify: typecheck, lint, vitest; chạy thử ở Task 7.
- [ ] Commit `feat(qc): khối QC theo giai đoạn trong trang dự án`.

### Task 5: Trang `/qc` — Việc QC của tôi

- `page.tsx`: `requireView("project")`; `where = { ketQua: { in: ["CHUA","KHONG_DAT"] }, project: { AND: [scope, { status: { not: "HOAN_THANH" } }] }, ...(role === "ADMIN" ? {} : { boPhan: role }) }`; include project (id, code, name, milestones type/planDate). `han` = `planDate` của mốc cùng giai đoạn. Sắp bằng `sapXepViecQc`.
- `BangViecQc.tsx` (client): lọc dự án / giai đoạn / kết quả (+ bộ phận khi ADMIN); bảng cột như spec; dòng link `/projects/${id}#qc`; rỗng → "Không có việc QC nào".
- [ ] Verify typecheck/lint. Commit `feat(qc): trang Việc QC của tôi`.

### Task 6: Trang `/qc-mau` + menu

- `actions.ts`: `luuQcMau(v)`, `batTatQcMau(id, active)`, `doiThuTuQcMau(id, dir)` — mỗi hàm `requireSession` + `role === "ADMIN"` (sai → lỗi), validate như `luuQcMuc`, `recordAudit` entity `"QcMau"` (thêm nhãn "Mẫu QC" vào `AUDIT_ENTITY`). `revalidatePath("/qc-mau")`.
- `page.tsx`: ADMIN mới vào (khác → `notFound()`); liệt kê theo giai đoạn, cả mục tắt (mờ).
- `QcMauEditor.tsx`: sửa tại chỗ, thêm cuối mỗi giai đoạn, ↑↓, bật/tắt.
- Sidebar: sau "Tổng quan dự án" thêm `{ href: "/qc", label: "Việc QC", icon: ClipboardCheck, resource: "project" }`; nhóm có mục ADMIN-only (xem cách mục "Người dùng" làm) thêm `{ href: "/qc-mau", label: "Mẫu QC", icon: ListChecks hoặc ClipboardList, resource: "user" }` (ADMIN có `user/view`).
- [ ] Verify typecheck/lint. Commit `feat(qc): bộ mẫu QC và mục menu`.

### Task 7: Chạy thử + review

- Build production, PGlite với dữ liệu thử phần 1 + mẫu QC; tạo danh mục từ mẫu cho N101; ENGINEERING đánh "Không đạt" thiếu ghi chú (bị chặn) rồi có ghi chú; SALES không thấy nút đánh mục KT; cờ ĐỎ QC hiện trên `/projects/tong-quan`; `/qc` của KT liệt kê đúng; bảng so sánh hiện dòng đơn hàng; `/qc-mau` sửa một mục.
- Review toàn nhánh bằng agent mới; sửa Critical/Important có test.
