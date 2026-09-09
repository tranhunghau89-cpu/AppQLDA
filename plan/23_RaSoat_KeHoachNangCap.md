# Rà soát toàn diện & Kế hoạch nâng cấp — QLDA Web

> Ngày rà soát: 2026-09-10 · Trên nhánh `master` @ `aed6681` (working tree sạch).
> Phạm vi: 15.693 dòng TS/TSX trong `src/` (111 file), `prisma/schema.prisma` (30 model),
> 9 script import, 8 migration, 23 tài liệu phase.

---

## PHẦN A — KẾT QUẢ RÀ SOÁT

### A0. Tổng quan sức khỏe dự án

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| TypeScript `tsc --noEmit` | ✅ Sạch (exit 0) | Không có `any`, không có `@ts-ignore` |
| ESLint `npx eslint src` | ❌ 11 lỗi, 12 cảnh báo | `npm run lint` đang fail |
| Kiểm thử tự động | ❌ Không có | 0 test file, 0 CI |
| Tài liệu | ✅ Rất tốt | README chi tiết + 23 phase doc |
| Kỷ luật code | ✅ Tốt | `ActionResult` nhất quán, zod ở 9/13 action file, 0 `console.log` |
| Bảo mật ở tầng vai trò | ✅ Có | 40 file gọi `requireSession`/`requireView`/`requirePermission` |
| Bảo mật ở tầng dự án | ❌ **Không được thực thi** | Xem A1.1 |

**Nhận định chung:** đây là một codebase được viết cẩn thận, có kiến trúc rõ ràng và tài liệu tốt
hơn phần lớn app nội bộ. Nó không cần viết lại. Điểm yếu tập trung ở 3 chỗ:
(1) một tính năng phân quyền được xây một nửa rồi bỏ dở, (2) hoàn toàn không có lưới an toàn
(test + CI + transaction), (3) giao diện chỉ dùng được trên máy tính bàn.

---

### A1. Bảo mật & toàn vẹn dữ liệu — **ƯU TIÊN CAO**

#### A1.1 ⛔ Phân quyền theo dự án (`ProjectMember`) đã xây nhưng KHÔNG được áp dụng

Đây là phát hiện nghiêm trọng nhất.

Đã có đầy đủ: model `ProjectMember` (`prisma/schema.prisma:30`), migration
`20260803120000_add_project_member`, UI gán thành viên (`projects/[id]/ProjectMembers.tsx`),
và bộ helper `src/lib/scope.ts` (`myProjectIds`, `canAccessProject`, `scopedProjectWhere`).

Nhưng khi grep toàn bộ `src/`, các helper này **chỉ được gọi ở 2 nơi**:
- `src/app/(app)/quick/actions.ts:18` — `canAccessProject`
- `src/app/(app)/layout.tsx` — `myProjects` (chỉ để đổ dropdown Quick-Add)

Hệ quả cụ thể:
- `projects/page.tsx:11` — `db.project.findMany()` **không có `where` scope** → mọi user thấy toàn bộ dự án.
- `projects/[id]/page.tsx:44` — `db.project.findUnique({ where: { id } })` **không kiểm tra membership**
  → bất kỳ user đăng nhập nào gõ URL `/projects/<id>` đều xem được chi tiết, giá bán, lợi nhuận.
- Toàn bộ `api/**` (hợp đồng, đơn hàng, dự toán, báo cáo) chỉ kiểm tra vai trò, không kiểm tra dự án.

Nghĩa là: giao diện "Thành viên dự án" tạo cảm giác dữ liệu đã được khoanh vùng, nhưng thực tế
không. Đây là loại lỗ hổng nguy hiểm hơn cả việc không có tính năng.

#### A1.2 ⛔ Token phiên đăng nhập bị commit vào git

`c2.txt`, `ca.txt`, `cv.txt` **đang được git theo dõi** (`git ls-files` xác nhận), dù về sau đã
được thêm vào `.gitignore`. Nội dung là cookie jar dạng Netscape chứa JWT `qlda_session` thật.

Token trong đó là của `localhost`, nhưng nó được ký bằng `AUTH_SECRET`. Một JWT HS256 lộ ra
cho phép tấn công brute-force offline vào secret; nếu secret local từng trùng secret production
thì kẻ tấn công có thể tự ký session ADMIN. Repo có 2 remote GitHub (`origin`, `deployrepo`).

**Xử lý:** `git rm --cached` 3 file → xóa khỏi lịch sử (`git filter-repo`) → **xoay `AUTH_SECRET`**
→ force-push cả 2 remote.

#### A1.3 Không thể thu hồi phiên đăng nhập

`src/lib/session.ts` ký JWT hạn 7 ngày, payload chỉ có `userId/email/name/role`, không có `jti`
hay số phiên bản. Không có bảng session phía server. Hệ quả:
- Vô hiệu hóa nhân viên (`user.active = false`) **không cắt được phiên đang chạy** — họ vẫn dùng app tới 7 ngày.
- Đổi mật khẩu không đăng xuất thiết bị khác.
- Đổi vai trò (ví dụ hạ từ ADMIN xuống SALES) không có hiệu lực tới khi token hết hạn, vì `role`
  nằm trong token chứ không đọc lại từ DB.

Với app quản lý công nợ và báo giá, đây là rủi ro thật khi có người nghỉ việc.

#### A1.4 Script `build` chạy migration lên production

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

Bất kỳ ai chạy `npm run build` trên máy có `.env` trỏ Supabase production đều **áp migration
thẳng lên DB thật**, kể cả khi chỉ định build thử. Cần tách thành `build` (chỉ generate + next build)
và `vercel-build`/`db:deploy` riêng.

#### A1.5 Không có giới hạn tốc độ đăng nhập

`src/app/api/auth/login/route.ts` không có rate-limit, không khóa tài khoản, không log lần thất bại.
Bcrypt cost 10 làm chậm nhưng không chặn được dò mật khẩu tự động.

#### A1.6 Không có nhật ký thay đổi (audit log)

Không có model nào ghi "ai đổi gì lúc nào". Trong khi app cho phép sửa: giá bán dự án, giá trị
hợp đồng, đợt thanh toán, công nợ, đơn giá báo giá. Khi số liệu lệch, không có cách truy nguyên.
Riêng `Proposal` có `decidedBy`, nhưng đó là ngoại lệ duy nhất.

#### A1.7 Thao tác "xóa hết rồi ghi lại" không nằm trong transaction

Toàn bộ codebase có **0 lần dùng `db.$transaction`**. Trong khi đó:

```ts
// src/app/(app)/estimate-templates/actions.ts:89-90
await db.estimateTemplateLine.deleteMany({ where: { templateId: id } });
if (lines.length > 0) await db.estimateTemplateLine.createMany({ data: lines });
```

Nếu `createMany` lỗi (mất mạng, timeout Supabase, payload sai kiểu), toàn bộ dòng của mẫu dự toán
**biến mất vĩnh viễn**. Cùng rủi ro với `projects/actions.ts:190` (gán NCC theo hạng mục).

---

### A2. Chất lượng & vận hành — **ƯU TIÊN CAO**

#### A2.1 ⛔ Không có một dòng test nào

15.693 dòng code, trong đó có logic tài chính thuần túy rất dễ kiểm thử và rất đắt nếu sai:

| File | Nội dung | Rủi ro nếu sai |
|---|---|---|
| `src/lib/profit.ts` | Tính tổng chi phí, lợi nhuận, biên LN, CP/m² | Sai số liệu ra quyết định |
| `src/lib/debt.ts` (280 dòng) | Công nợ phải thu/phải trả, ưu tiên nguồn quyết toán → HĐ → giá bán | Đòi nhầm tiền CĐT/NCC |
| `src/lib/contract.ts` | Tổng HĐ, VAT | Sai giá trị hợp đồng |
| `src/lib/quote.ts` | Tổng báo giá, giá gốc, lợi nhuận | Báo giá lỗ |
| `src/lib/estimateTemplate.ts` | Suy diễn khối lượng INPUT → DERIVED theo hệ số | Sai dự toán |
| `src/lib/takeoff.ts`, `steel-data.ts` | Bóc khối lượng thép, tra 409 mã | Sai khối lượng đặt hàng |

Đây đều là hàm thuần, không chạm DB — chi phí viết test rất thấp, giá trị rất cao.

#### A2.2 `npm run lint` đang fail — 11 lỗi

Đáng chú ý là 5 lỗi `react-hooks/purity`: gọi `Date.now()` trực tiếp trong lúc render
(`weekly/page.tsx:85`, `projects/[id]/Payments.tsx:37`, và 3 chỗ khác). Với React 19 + Next 16
đây không chỉ là cảnh báo phong cách — nó gây lệch hydration và kết quả không ổn định khi
component re-render. Cần đưa mốc thời gian ra ngoài render (tính 1 lần ở server, truyền xuống).

Còn lại: 2 lỗi `react/no-unescaped-entities` (`tools/SteelLookup.tsx:115`), 4 cảnh báo
`no-unused-expressions`, 4 biến không dùng, 2 `<img>` chưa dùng `next/image`.

#### A2.3 5 file "lách" hệ kiểu của Prisma

`doc-versions.ts`, `payments.ts`, `proposals.ts`, `project-notes.ts`, `takeoff.ts` đều dùng mẫu:

```ts
export const docVersionDb = (db as unknown as { docVersion: DocVersionDelegate }).docVersion;
```

Tức là tự khai báo lại interface delegate rồi ép kiểu. Đây là cách vá lúc Prisma Client chưa được
generate lại. Hậu quả: nếu schema đổi (thêm cột, đổi kiểu), TypeScript **không báo lỗi** — sai sót
chỉ lộ ra lúc chạy. Nay `prisma generate` đã chạy trong `postinstall`, các wrapper này nên gỡ bỏ
để quay về kiểu thật do Prisma sinh ra.

#### A2.4 Không có `error.tsx` / `loading.tsx` / `not-found.tsx`

0 file trong toàn bộ `src/app`. Một lỗi DB bất kỳ (Supabase ngắt kết nối, pool cạn) → người dùng
thấy màn hình lỗi trắng của Next, không có nút thử lại, không có thông báo tiếng Việt. Chuyển trang
cũng không có skeleton — chỉ đứng im chờ server component render xong.

#### A2.5 48 lần dùng `alert()` / `confirm()`

Repo đã có sẵn `src/components/ui/modal.tsx` nhưng các luồng xác nhận/thông báo vẫn dùng hộp thoại
mặc định của trình duyệt. Trên app quản trị dùng hằng ngày, đây là điểm trừ trải nghiệm rõ nhất.

#### A2.6 Phụ thuộc thừa

`date-fns` nằm trong `dependencies` nhưng **0 file nào import**. Gỡ bỏ.

#### A2.7 Không có CI

Không có `.github/`. Mọi kiểm tra (typecheck, lint, build) đều thủ công. Với luồng deploy
`master → deployrepo/main → Vercel`, một commit hỏng sẽ đi thẳng lên production.

---

### A3. Hiệu năng & khả năng mở rộng — **ƯU TIÊN TRUNG BÌNH** (sẽ thành cao khi dữ liệu tăng)

#### A3.1 Không phân trang ở bất kỳ đâu

58 lần gọi `findMany`, **0 lần dùng `take`**. Mọi danh sách (dự án, hợp đồng, đơn hàng, công nợ,
bảng đơn giá 135 mã, tra thép 409 mã) đều nạp toàn bộ về rồi lọc phía client.

Hiện tại ~56 dự án nên chưa thấy chậm. Nhưng dashboard đang nạp:

```ts
// src/app/(app)/page.tsx:18
db.project.findMany({ include: { estimateItems: {...}, costSummary: {...}, milestones: {...} } })
```

tức là **toàn bộ dòng dự toán của mọi dự án** rồi cộng dồn bằng JavaScript. Ở mốc ~200 dự án
× vài trăm dòng/dự án, đây sẽ là vài chục nghìn hàng cho mỗi lần mở trang chủ.

#### A3.2 Không có cache

0 lần dùng `revalidate`, `unstable_cache`, hay `"use cache"`. Mỗi lần điều hướng đều truy vấn lại
Supabase qua pooled connection từ Vercel — độ trễ mạng cộng dồn.

#### A3.3 Thiếu index trên khóa ngoại

PostgreSQL **không tự tạo index cho FK**. Schema có 9 `@@index`, nhưng chỉ trên các model mới
(`ProjectNote`, `DocVersion`, `Proposal`, `Payment`, `TakeoffItem`…). Các model bị truy vấn
nhiều nhất lại thiếu:

| Model | Cột cần index |
|---|---|
| `EstimateItem` | `projectId` (chỉ có `@@index([sectionId])`) |
| `Contract` | `projectId` |
| `ContractItem` | `contractId` |
| `PurchaseOrder` | `projectId`, `supplierId` |
| `PurchaseOrderItem` | `orderId` |
| `Quote` / `QuoteSection` / `QuoteItem` | `projectId`, `quoteId` |
| `CostCategory` / `CostItem` | `summaryId`, `categoryId` |
| `Project` | `status`, `customerId` |

#### A3.4 Ghi báo giá theo từng dòng

`projects/[id]/quote/actions.ts` cập nhật từng `quoteItem` bằng một lệnh riêng (dòng 198, 321).
Với báo giá vài trăm dòng, "Cập nhật đơn giá toàn bộ" tạo ra vài trăm round-trip tới Supabase.

---

### A4. Giao diện & trải nghiệm — **ƯU TIÊN TRUNG BÌNH–CAO**

#### A4.1 ⛔ Chỉ dùng được trên máy tính bàn

Toàn bộ `src/` chỉ có **37 lần dùng breakpoint** (`sm:`/`md:`/`lg:`/`xl:`) trên ~60 file TSX.
Cụ thể:
- `layout.tsx` dùng `flex h-screen overflow-hidden` — khóa cứng chiều cao màn hình.
- `Sidebar.tsx` là `w-60 shrink-0`, **không có nút hamburger, không thể thu gọn**.
- Chỉ 4 file bọc bảng trong `overflow-x-auto` — các bảng còn lại tràn viewport hẹp.

Với một app quản lý thi công kết cấu thép, việc chỉ huy công trường không mở được app trên
điện thoại để ghi nhật ký tuần hoặc kiểm tra đơn hàng là hạn chế lớn nhất về mặt nghiệp vụ.

#### A4.2 0 thuộc tính `aria-`

Không có `aria-label` trên nút icon-only, không có `role`/`aria-live` cho thông báo, modal không
bẫy focus. Điều hướng bằng bàn phím và trình đọc màn hình gần như không dùng được.

#### A4.3 Chưa có tìm kiếm toàn cục và thông báo

Dashboard đã tính được `lateItems` (mốc trễ hạn) và `dueSoon`/`overdue` (công nợ đến hạn) nhưng
thông tin chỉ hiện khi người dùng chủ động mở trang chủ. Không có email/Zalo nhắc việc.

---

### A5. Khoảng trống nghiệp vụ

| Thiếu | Vì sao đáng làm |
|---|---|
| Nhập Excel qua web | 9 script import chỉ chạy được bằng CLI trên máy dev → nhân viên không tự nhập được |
| Xuất PDF báo giá / hợp đồng | Hiện chỉ có Excel; báo giá gửi CĐT cần PDF có logo |
| Lịch sử thay đổi số liệu | Xem A1.6 |
| Ảnh hiện trường theo tuần | Đã có `NoteImage` cho ghi chú, chưa gắn vào `WeeklyLog` |
| Báo cáo kỳ (tháng/quý) | Có `api/reports/summary` xuất Excel, chưa có dashboard theo kỳ |
| Nhánh `deploy` cũ | `deploy` đang tụt sau `master` ≥5 commit; chỉ `deployrepo/main` là bản chuẩn → dễ nhầm |

---

## PHẦN B — KẾ HOẠCH NÂNG CẤP

Nguyên tắc: **không viết lại**. Toàn bộ là nâng cấp tăng dần trên kiến trúc hiện tại
(Next 16 App Router + Prisma + Supabase), giữ nguyên quy ước phase doc của repo.

Thứ tự đề xuất: bịt lỗ hổng trước → dựng lưới an toàn → rồi mới mở rộng.

---

### Phase 21 — Bịt lỗ hổng bảo mật (1–2 ngày công) 🔴 LÀM TRƯỚC

**Mục tiêu:** không còn đường đọc dữ liệu ngoài phạm vi được giao; không còn bí mật trong git.

1. **Áp scope dự án ở mọi điểm vào** *(A1.1)*
   - `projects/page.tsx`: thêm `where: await scopedProjectWhere(session)`.
   - `projects/[id]/**` (7 trang: detail, estimate, contract, purchase, quote, cost): thêm
     `if (!(await canAccessProject(session, id))) notFound()`.
   - Tất cả `actions.ts` có tham số `projectId`: gọi `canAccessProject` trước khi ghi.
   - 6 API route theo id (`contracts`, `costs`, `purchases`, `po-images`, `export/estimate`,
     `takeoff/[projectId]/export`): kiểm tra dự án chủ quản.
   - Các trang tổng hợp (`estimates`, `contracts`, `purchases`, `costs`, `debts`, `gantt`,
     `weekly`, dashboard): lọc theo scope.
   - Viết một helper duy nhất `requireProjectAccess(resource, action, projectId)` trong
     `src/lib/auth.ts` để không lặp lại logic ở 20+ chỗ.

2. **Dọn bí mật khỏi git** *(A1.2)*
   - `git rm --cached c2.txt ca.txt cv.txt`
   - `git filter-repo` xóa khỏi toàn bộ lịch sử → force-push `origin` + `deployrepo`.
   - Sinh `AUTH_SECRET` mới (32 byte ngẫu nhiên) → cập nhật Vercel env → mọi người đăng nhập lại.

3. **Thu hồi phiên được** *(A1.3)*
   - Thêm `User.tokenVersion Int @default(0)`; đưa vào payload JWT.
   - `proxy.ts` (hoặc một `getSessionStrict()` phía server) đối chiếu `tokenVersion` với DB.
   - Đổi mật khẩu / vô hiệu hóa user / đổi vai trò → `tokenVersion++`.
   - *Lưu ý:* việc này thêm 1 truy vấn DB mỗi request. Cân nhắc chỉ kiểm tra ở server component
     gốc `(app)/layout.tsx` thay vì trong middleware Edge, để tránh chi phí trên mọi asset.

4. **Tách script build** *(A1.4)*
   ```json
   "build": "prisma generate && next build",
   "db:deploy": "prisma migrate deploy",
   "vercel-build": "prisma generate && prisma migrate deploy && next build"
   ```

5. **Rate-limit đăng nhập** *(A1.5)* — đếm số lần sai theo IP + email trong bộ nhớ (hoặc bảng
   `LoginAttempt`), khóa 15 phút sau 10 lần sai. Ghi log lần đăng nhập thất bại.

**Nghiệm thu:** đăng nhập bằng `kythuat@cty.com` (chưa gán dự án X) → gõ URL `/projects/<X>`
phải ra 404; gọi thẳng `/api/export/estimate/<X>` phải ra 403. Vô hiệu hóa 1 user → tab đang mở
của họ bị đá về `/login` ngay lần điều hướng kế tiếp.

---

### Phase 22 — Lưới an toàn: test + CI + transaction (2–3 ngày công) 🔴

**Mục tiêu:** không thể đẩy lên production một thay đổi làm sai số tiền.

1. **Vitest + test cho logic thuần** *(A2.1)* — mục tiêu ≥80% dòng cho 6 file ở bảng A2.1.
   Ưu tiên `debt.ts` (phức tạp nhất, nhiều nhánh ưu tiên nguồn dữ liệu) và `profit.ts`.
   Lấy chính số liệu thật từ `THCPMau/*.xlsx` làm fixture để test khớp với Excel gốc.
2. **Sửa 11 lỗi ESLint** *(A2.2)* — đặc biệt 5 lỗi `Date.now()` trong render: tính `now` ở
   server component rồi truyền xuống props.
3. **Bọc transaction** *(A1.7)* — `db.$transaction` cho `saveTemplate`, `assignSuppliers`,
   `applyTemplate`, và mọi chỗ "xóa rồi ghi lại".
4. **GitHub Actions** *(A2.7)* — workflow chạy `tsc --noEmit` + `eslint` + `vitest` + `next build`
   trên PR và trên push `master`. Chặn merge khi đỏ.
5. **Gỡ 5 wrapper ép kiểu Prisma** *(A2.3)* + gỡ `date-fns` *(A2.6)*.

**Nghiệm thu:** `npm test && npm run lint && npx tsc --noEmit` xanh; CI chạy được trên PR thử.

---

### Phase 23 — Dùng được trên điện thoại (3–4 ngày công) 🟠

**Mục tiêu:** chỉ huy công trường ghi nhật ký tuần và tra đơn hàng bằng điện thoại.

1. **Layout đáp ứng** *(A4.1)* — sidebar thành drawer trượt trên `<lg`, thêm nút hamburger ở
   `Topbar`, bỏ `h-screen overflow-hidden` cứng, bọc mọi bảng trong `overflow-x-auto`.
2. **Ưu tiên 4 màn hình cho mobile** (không cần làm tất cả): Tổng quan · Tiến độ tuần ·
   Chi tiết dự án · Đơn hàng. Bảng rộng chuyển sang dạng thẻ (card) trên màn hẹp.
3. **Chụp/tải ảnh hiện trường từ điện thoại** — gắn `NoteImage` vào `WeeklyLog` *(A5)*.
4. **Trạng thái tải & lỗi** *(A2.4)* — thêm `loading.tsx` + `error.tsx` cho mỗi nhóm route,
   thông báo lỗi tiếng Việt, có nút "Thử lại".
5. **Thay `alert`/`confirm` bằng toast + modal có sẵn** *(A2.5)* — 48 chỗ.
6. **Nền tảng a11y** *(A4.2)* — `aria-label` cho nút icon-only, bẫy focus trong modal,
   `aria-live` cho toast.

**Nghiệm thu:** kiểm thử ở 375px và 768px; hoàn tất luồng "ghi nhật ký tuần + đính ảnh" trên
điện thoại thật.

---

### Phase 24 — Hiệu năng & khả năng chịu tải (1–2 ngày công) 🟠

1. **Thêm index còn thiếu** *(A3.3)* — 1 migration, tác động lớn nhất trên chi phí bỏ ra.
2. **Dashboard tổng hợp trong DB** *(A3.1)* — thay nạp-hết-rồi-cộng bằng `groupBy`/`aggregate`;
   hoặc thêm bảng tổng hợp `ProjectRollup` cập nhật khi ghi.
3. **Phân trang + tìm kiếm phía server** cho Dự án, Đơn hàng, Hợp đồng, Bảng đơn giá *(A3.1)*.
4. **Cache** *(A3.2)* — các dữ liệu ít đổi (bảng đơn giá, tra thép 409 mã, danh sách CĐT/NCC)
   dùng cache có tag, `revalidateTag` khi ghi.
5. **Ghi báo giá theo lô** *(A3.4)* — gộp cập nhật nhiều dòng vào 1 `$transaction`.

**Nghiệm thu:** đo thời gian tải trang chủ trước/sau với bộ dữ liệu nhân tạo 500 dự án.

---

### Phase 25 — Truy vết & kiểm soát (2 ngày công) 🟡

1. **Model `AuditLog`** *(A1.6)*: `actorId`, `actorName`, `entity`, `entityId`, `action`,
   `before` (Json), `after` (Json), `createdAt`. Ghi ở tầng server action cho các thực thể tiền:
   `Project.salePrice`, `Contract`, `Payment`, `CostSummary`, `Quote`, `WorkPrice`.
2. **Tab "Lịch sử"** trên trang chi tiết dự án + trang `/audit` cho ADMIN.
3. **Nhắc việc**: job hằng ngày (Vercel Cron) gửi email/Zalo danh sách mốc trễ hạn + công nợ
   đến hạn cho ADMIN và người phụ trách *(A4.3)*.

---

### Phase 26 — Mở rộng nghiệp vụ (theo nhu cầu) 🟡

1. **Nhập Excel qua web** *(A5)* — chuyển 9 script CLI thành luồng upload + xem trước + xác nhận,
   giới hạn cho ADMIN. Đây là hạng mục giải phóng nhiều công sức nhất cho người dùng cuối.
2. **Xuất PDF báo giá / hợp đồng** có logo và mẫu công ty.
3. **Tìm kiếm toàn cục** (⌘K) trên dự án / CĐT / NCC / mã công việc.
4. **Báo cáo theo kỳ** — dashboard tháng/quý, so sánh dự toán ↔ quyết toán.

---

### Phase 27 — Dọn dẹp kho mã (0,5 ngày công) 🟢

- Xóa hoặc đồng bộ nhánh `deploy` đang tụt sau `master`; ghi rõ trong README rằng
  `deployrepo/main` mới là bản deploy.
- Xóa `dev.log`, `tsconfig.tsbuildinfo`, `cookies.txt` khỏi thư mục làm việc.
- Đưa `MKT.LANDINGPAGE.SKILLS-main/` ra khỏi thư mục dự án (đã ignore nhưng vẫn nằm trong repo dir).
- Bổ sung mục "Bảo mật" vào README: quy trình xoay `AUTH_SECRET`, quy tắc không commit token.

---

## Tổng hợp thứ tự ưu tiên

| Phase | Nội dung | Công sức | Mức độ |
|---|---|---|---|
| 21 | Bịt lỗ hổng bảo mật | 1–2 ngày | 🔴 Làm ngay |
| 22 | Test + CI + transaction | 2–3 ngày | 🔴 Làm ngay |
| 23 | Dùng được trên điện thoại | 3–4 ngày | 🟠 Cao |
| 24 | Hiệu năng | 1–2 ngày | 🟠 Cao |
| 25 | Audit log + nhắc việc | 2 ngày | 🟡 Vừa |
| 26 | Mở rộng nghiệp vụ | tùy chọn | 🟡 Vừa |
| 27 | Dọn dẹp kho mã | 0,5 ngày | 🟢 Thấp |

**Tổng cho phần bắt buộc (21–24): khoảng 7–11 ngày công.**

Đề xuất làm Phase 21 và 22 liền nhau trong một đợt: sửa bảo mật mà không có test đi kèm thì
rất dễ làm hỏng luồng đang chạy.
