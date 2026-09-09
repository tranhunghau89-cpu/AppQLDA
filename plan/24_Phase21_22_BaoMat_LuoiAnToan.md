# Phase 21 + 22 — Bịt lỗ hổng bảo mật & dựng lưới an toàn

> Ngày 2026-09-10. Thực hiện theo `plan/23_RaSoat_KeHoachNangCap.md` (mục Phase 21 và 22).
> Trạng thái: **code hoàn tất, đã kiểm tra tĩnh + build + test; CHƯA kiểm thử end-to-end**
> vì DB Supabase trong `.env` hiện không kết nối được (xem mục "Việc còn lại").

---

## Phase 21 — Bảo mật

### 21.1 Áp phạm vi dự án (`ProjectMember`) ở mọi điểm vào

Trước đây `src/lib/scope.ts` chỉ được dùng ở 2 nơi. Nay mọi truy vấn chạm dữ liệu
dự án đều đi qua bộ lọc phạm vi.

**Helper mới**

| Nơi | Hàm | Dùng cho |
|---|---|---|
| `lib/scope.ts` | `scopedByProjectWhere(session)` | bảng có cột `projectId` (Contract, PurchaseOrder, CostSummary, Quote, Payment) |
| `lib/scope.ts` | `scopedByOptionalProjectWhere(session)` | bảng có `projectId` nullable (Proposal) — bản ghi không gắn dự án luôn hiện |
| `lib/auth.ts` | `requireProjectView(resource, projectId)` | đầu Server Component trang chi tiết → ngoài phạm vi = **404** (không lộ dự án có tồn tại) |
| `lib/auth.ts` | `requireProjectPermission(resource, action, projectId)` | bản ném lỗi, cho action bọc try/catch |
| `lib/auth.ts` | `denyProject(resource, action, projectId, fallback)` | bản **không ném**, trả `ActionResult` lỗi — dùng ở hầu hết server action |

**Trang đã áp scope** (13): `/` · `/projects` · `/projects/[id]` (+ 5 trang con:
contract, cost, estimate, purchase, quote) · `/estimates` · `/contracts` · `/purchases` ·
`/costs` · `/quotes` · `/debts` · `/gantt` · `/weekly` · `/approvals` · `/tools` ·
`/customers` · `/suppliers` (cột công nợ).

**API route đã áp scope** (8): `export/projects` · `export/estimate/[id]` ·
`reports/summary` · `contracts/[id]/file` · `costs/[id]/file` · `purchases/[id]/file` ·
`po-images/[id]` · `takeoff/[projectId]/export`.
Route `takeoff/[projectId]/export` trước đó **chỉ kiểm tra đăng nhập, không kiểm tra vai trò** —
đã bổ sung `can(role, "project", "view")`.

**Server action đã áp scope** (30+ hàm trong 8 file): `projects/actions.ts`,
`projects/[id]/{contract,estimate,purchase,quote}/actions.ts`, `tools/actions.ts`,
`approvals/actions.ts` (`quick/actions.ts` đã có sẵn từ Phase 19).

**Không tin id đến từ client.** Mọi action nhận `projectId` kèm id thực thể
(`contractId`, `orderId`, `itemId`, `quoteId`, `sectionId`, `imageId`, `paymentId`)
đều đối chiếu thực thể đó có thuộc `projectId` không, thay vì chỉ tin tham số:

- `contract/actions.ts` — `guard(projectId, fallback, contractId)`
- `purchase/actions.ts` — `guard(projectId, fallback, { orderId, itemId, imageId })`
  (truy ngược ảnh → dòng vật tư → đơn hàng → dự án)
- `quote/actions.ts` — `guard(projectId, { quoteId, sectionId, itemId })`
- `estimate/actions.ts` — `guard(projectId, fallback, itemId)`
- `markPaymentPaid` / `deletePayment` — lấy `projectId` từ chính bản ghi Payment.

**Vá thêm 2 chỗ rò dữ liệu chéo dự án:**
- `/projects/[id]/quote` — danh sách "Tạo từ dự án khác" trước đây liệt kê **mọi báo giá
  của mọi dự án**; nay lọc theo phạm vi, và `cloneQuoteFrom` kiểm tra thêm dự án nguồn.
- `/weekly` — ghi chú, hồ sơ, đơn hàng trước đây nạp toàn bộ; nay lọc theo danh sách
  dự án đã scope (đồng thời là cải thiện hiệu năng).

**Tác dụng phụ cần biết:** người tạo dự án mới (không phải ADMIN) được **tự động thêm
làm thành viên**, nếu không họ sẽ mất quyền vào chính dự án vừa tạo.

### 21.2 Thu hồi phiên đăng nhập (`tokenVersion`)

- Schema: `User.tokenVersion Int @default(0)` + migration
  `prisma/migrations/20260910090000_user_token_version/migration.sql` (**viết tay**, cố ý
  không chạy `prisma migrate dev` để không chạm DB thật).
- `SessionUser` mang thêm `tokenVersion`; login đưa giá trị hiện tại vào JWT.
- `getSession()` nay là **Data Access Layer** đúng khuyến nghị của Next
  (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`): bọc `cache()` của React
  để gộp lời gọi trong 1 request, rồi đối chiếu DB — tài khoản còn `active` và
  `tokenVersion` khớp. **Vai trò luôn đọc từ DB, không tin token.**
- `saveUser` tăng `tokenVersion` khi: đổi mật khẩu · đổi vai trò · khóa tài khoản.

Kết quả: khóa tài khoản / đổi mật khẩu / hạ vai trò có hiệu lực **ngay lần điều hướng kế tiếp**,
không phải chờ token 7 ngày hết hạn.

*Đánh đổi:* thêm 1 truy vấn DB mỗi request (đã gộp bằng `cache()`). Middleware `proxy.ts`
giữ nguyên vai trò cổng chặn rẻ tiền (chỉ verify chữ ký, chạy trên Edge); việc đối chiếu DB
nằm ở tầng Node.

### 21.3 Chống dò mật khẩu

`src/lib/rate-limit.ts` — đếm theo **cả IP và email** (không né được bằng cách đổi một trong hai),
10 lần sai trong 15 phút → chặn 15 phút, trả `429` kèm `Retry-After`. Đăng nhập thành công
xóa bộ đếm. Ghi log mỗi lần thất bại.

*Hạn chế đã biết:* bộ đếm nằm trong bộ nhớ tiến trình → mỗi instance serverless đếm riêng và
mất khi instance bị thu hồi. Đủ chặn dò tự động cho app nội bộ; muốn chắc hơn thì chuyển sang
bảng DB / Redis.

### 21.4 Tách script build khỏi migration production

```json
"build":        "prisma generate && next build",              // an toàn, KHÔNG chạm DB
"vercel-build": "prisma generate && prisma migrate deploy && next build",
"db:deploy":    "prisma migrate deploy"
```

> ⚠️ **Vercel ưu tiên `vercel-build` nếu có**, nên deploy vẫn chạy migration như cũ.
> Từ nay `npm run build` trên máy cá nhân không còn áp migration lên DB thật.

### 21.5 Dọn token khỏi git

`git rm --cached c2.txt ca.txt cv.txt` — 3 file cookie jar chứa JWT `qlda_session` thật đã
được bỏ theo dõi (đã có trong `.gitignore` từ trước). **Xóa khỏi lịch sử + xoay `AUTH_SECRET`
vẫn còn phải làm thủ công** — xem "Việc còn lại".

---

## Phase 22 — Lưới an toàn

### 22.1 Vitest + 129 test

`vitest.config.ts` (alias `@` và stub `server-only`), script `npm test` / `npm run test:watch`.

| File test | Số test | Nội dung |
|---|---|---|
| `debt.test.ts` | 28 | thứ tự ưu tiên quyết toán→HĐ→giá bán, khớp NCC theo tên chuẩn hóa, trả vượt VAT ⇒ tất toán, gom nhóm |
| `profit.test.ts` | 14 | thành tiền, biên LN, CP/m², chia cho 0, lỗ |
| `quote.test.ts` | 13 | tổng bán/gốc/lợi nhuận, giá thành = (VT+NC)×HS, đơn giá bán = gốc×TL |
| `utils.test.ts` | 12 | `parseViNumber` (dấu chấm nghìn / phẩy thập phân) |
| `rbac.test.ts` | 11 | ma trận phân quyền, bất biến "edit ⇒ view" |
| `estimateTemplate.test.ts` | 11 | tham số cộng dồn INPUT→DERIVED, hệ số, NaN/Infinity |
| `takeoff-shared.test.ts` | 11 | BT/VK theo nhóm cấu kiện, thép tổ hợp, bản mã |
| `rate-limit.test.ts` | 10 | ngưỡng chặn, hết hạn, độc lập theo khóa |
| `week.test.ts` | 10 | tuần ISO qua ranh giới năm |
| `contract.test.ts` | 9 | tổng HĐ, VAT |

Để test được `debt.ts`, phần tính toán đã được **tách khỏi truy vấn**:
`buildReceivables()` / `buildPayables()` là hàm thuần; `getReceivables(scope)` /
`getPayables(scope)` chỉ lo truy vấn + áp phạm vi.

### 22.2 ESLint: 11 lỗi + 12 cảnh báo → **0**

- **5 lỗi `react-hooks/purity`** (`Date.now()` trong render): thêm `src/lib/now.ts` với
  `serverNow()` — một chỗ duy nhất đọc đồng hồ, chỉ dùng ở server. Server component lấy mốc
  thời gian **một lần** rồi truyền xuống client qua props. `Payments.tsx` (client) nay nhận
  prop `now` thay vì tự gọi `Date.now()` → hết nguy cơ lệch hydration.
- **1 lỗi "Cannot reassign variable after render"**: dashboard cộng dồn `totalRevenue`/`totalCost`
  bằng cách mutate biến ngoài trong `.map()` → đổi sang `reduce`.
- 2 lỗi escape `"` trong JSX; `prefer-const`; 2 chỉ thị `eslint-disable` đặt sai dòng.
- Xóa 3 đoạn code chết: `openEdit` (ProjectList), `refresh` (ContractEditor), setter `setNote`.

### 22.3 Transaction

Trước: **0** lần dùng `$transaction` trong toàn bộ codebase. Nay 3 chỗ ghi nhiều bước:

1. `saveTemplate` — `update + deleteMany + createMany` (lỗi giữa chừng từng có thể **xóa
   trắng toàn bộ dòng của mẫu dự toán**).
2. `cloneQuoteFrom` — báo giá + phần/mục + dòng.
3. `repriceQuote` — cập nhật đơn giá hàng loạt (tránh nửa giá cũ nửa giá mới).

### 22.4 CI

`.github/workflows/ci.yml` — chạy trên PR và push `master`: `typecheck` → `lint` → `test` → `build`.
Dùng biến môi trường giả; **không kết nối DB thật** (nhờ 21.4).

### 22.5 Gỡ 5 wrapper ép kiểu Prisma

`doc-versions.ts`, `payments.ts`, `proposals.ts`, `project-notes.ts`, `takeoff.ts` trước đây tự
khai báo interface delegate rồi `db as unknown as {...}` → schema đổi mà TypeScript không báo lỗi.
Nay dùng thẳng delegate và kiểu do Prisma sinh ra. (Cũng là điều kiện cần: kiểu tự khai báo
không hỗ trợ `projectId: { in: [...] }` mà bộ lọc scope cần.)

Đồng thời gỡ `date-fns` (0 nơi dùng).

---

## Kiểm chứng đã thực hiện

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 lỗi, 0 cảnh báo |
| `npm test` (Vitest) | ✅ 129/129 |
| `npm run build` (không DB) | ✅ 36 route, tất cả `ƒ` (dynamic) |
| Rà soát tĩnh mọi truy vấn bảng gắn dự án | ✅ 11 loại truy vấn, tất cả có `where` scope |
| `cache()` trong Route Handler | ✅ xác nhận chạy được (dev server, stack trace đi xuyên qua) |

**CHƯA kiểm thử end-to-end** (đăng nhập bằng tài khoản không phải ADMIN rồi gõ URL dự án
ngoài phạm vi) — xem lý do bên dưới.

---

## Việc còn lại (cần con người thực hiện)

### 1. 🔴 DB Supabase hiện không kết nối được

```
FATAL: (ENOTFOUND) tenant/user postgres.vibxdzmmfjvobqzlnyup not found
```

Host `aws-0-ap-northeast-1.pooler.supabase.com` từ chối tenant trong `DATABASE_URL`.
Thường do: project Supabase bị **tạm dừng** (gói free tự dừng khi lâu không dùng),
bị xóa, hoặc mật khẩu/user đã đổi. Đây là tình trạng **có sẵn từ trước**, không phải do
các thay đổi ở đây gây ra — nhưng nó chặn:
- áp migration `tokenVersion`,
- chạy `members:backfill`,
- kiểm thử end-to-end.

### 2. Áp migration + gán thành viên

```bash
npm run db:deploy            # áp migration tokenVersion
npm run members:backfill -- --dry-run
npm run members:backfill     # gán mọi user (trừ ADMIN) vào mọi dự án
```

> ⚠️ **Quan trọng:** sau Phase 21, user không phải ADMIN mà **chưa được gán dự án nào sẽ
> không thấy gì cả**. Script `members:backfill` giữ nguyên hiện trạng (ai cũng thấy mọi dự án)
> để không gián đoạn công việc; ADMIN thu hẹp dần trên UI mục "Thành viên dự án".
> Nếu muốn siết ngay thì bỏ qua script này. Trang `/projects` đã có thông báo hướng dẫn
> cho người chưa được phân công.

### 3. Xoay `AUTH_SECRET` + xóa token khỏi lịch sử git

```bash
git rm --cached c2.txt ca.txt cv.txt   # ĐÃ LÀM
# còn lại — cần cân nhắc vì viết lại lịch sử + force-push 2 remote:
pip install git-filter-repo
git filter-repo --path c2.txt --path ca.txt --path cv.txt --invert-paths
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AUTH_SECRET mới
```
Cập nhật `AUTH_SECRET` trên Vercel → mọi người đăng nhập lại → force-push `origin` + `deployrepo`.

### 4. Kiểm thử end-to-end sau khi DB hoạt động

1. Đăng nhập `kythuat@cty.com` (chưa gán dự án X) → gõ `/projects/<X>` phải ra **404**.
2. `GET /api/export/estimate/<X>` → **404**; `/api/reports/summary` chỉ chứa dự án được gán.
3. ADMIN khóa 1 tài khoản → tab đang mở của người đó bị đá về `/login` ngay lần bấm kế tiếp.
4. Sai mật khẩu 10 lần → **429** kèm `Retry-After`.
5. ADMIN vẫn thấy đầy đủ mọi dự án như trước.

---

## Ngoài phạm vi (đã cân nhắc, chưa làm)

- `/customers` và `/suppliers` vẫn hiển thị `_count.projects` trên toàn bộ dự án. Đây là dữ
  liệu danh mục dùng chung, mức lộ thông tin không đáng kể — chấp nhận, ghi nhận lại.
- Audit log (Phase 25), phân trang & index (Phase 24), giao diện điện thoại (Phase 23).
- Rate-limit dùng bộ nhớ tiến trình, chưa dùng DB/Redis.
