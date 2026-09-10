# Phase 27 — Dọn dẹp kho mã

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 27.
> Đây là phase cuối của bản rà soát.

---

## 27.1 File rác trong thư mục làm việc

Đã xóa: `dev.log`, `cookies.txt`, `c2.txt`, `ca.txt`, `cv.txt`, `tsconfig.tsbuildinfo`.

Cả 6 file đều **đã nằm trong `.gitignore` và không được git theo dõi** — chúng chỉ là
rác còn sót trên máy. Đã kiểm nội dung từng file trước khi xóa: `dev.log` là log của
`next dev`, `tsconfig.tsbuildinfo` là bộ đệm biên dịch (tự sinh lại), bốn file còn lại
là cookie jar của `curl` chứa token phiên.

## 27.2 Nhánh `deploy`

Đã xóa nhánh local `deploy`.

Kiểm trước khi xóa: `git rev-list --left-right --count deploy...master` cho **`0 33`** —
nhánh này tụt 33 commit sau `master` và **không có commit nào của riêng nó**. Nó cũng
không tồn tại trên bất kỳ remote nào. Xóa bằng `git branch -d` (không phải `-D`) để
chính git xác nhận không mất gì.

Giữ lại chỉ gây nhầm với `deployrepo/main` — nhánh thật sự đang chạy.

## 27.3 Thư mục lạ `MKT.LANDINGPAGE.SKILLS-main/`

**Chưa động vào — cố ý.** Thư mục này nặng **992MB** và nằm trong OneDrive của công ty.
Nó đã được `.gitignore` bỏ qua nên **không ảnh hưởng gì tới kho mã**; lợi ích duy nhất
của việc chuyển đi là tăng tốc các lệnh quét file.

Di chuyển 1GB trong OneDrive sẽ kích hoạt một đợt đồng bộ lại rất lớn — đó là hệ quả
thấy rõ trên máy người dùng, không nên tự ý làm. Lệnh để tự chạy khi muốn:

```bash
mv "MKT.LANDINGPAGE.SKILLS-main" ../
```

## 27.4 README — sửa một lỗi có thể gây mất dữ liệu

README ghi *"Prisma 6 + **SQLite** (dev) — đổi sang PostgreSQL khi lên cloud"* và hướng
dẫn chạy `npx prisma migrate dev`. Nhưng `prisma/schema.prisma` đã là **`postgresql`**
từ lâu, và `DATABASE_URL` trỏ thẳng vào Supabase.

Người làm theo README sẽ chạy `migrate dev` **lên cơ sở dữ liệu thật**. Lệnh đó có thể
**xóa và dựng lại toàn bộ DB** khi thấy lịch sử migration lệch. Đây không phải lỗi
chính tả trong tài liệu — đây là một cái bẫy.

Đã sửa thành `migrate deploy`, kèm cảnh báo giải thích vì sao.

### Các mục khác đã cập nhật

| Mục | Trước | Sau |
|---|---|---|
| Công nghệ | SQLite (dev) | PostgreSQL / Supabase, kèm ghi chú `proxy.ts` của Next 16 |
| Chạy lần đầu | `migrate dev` | `migrate deploy` + copy `.env.example` |
| Tài khoản mẫu | 4 tài khoản | 5 — thêm Kế toán |
| Tính năng | thiếu 6 module | thêm Nhập Excel, Báo cáo kỳ, Nhật ký, Ctrl+K, In PDF, Nhắc việc |
| Phân quyền | 4 vai trò | 5 vai trò + mục **Phạm vi dự án** giải thích hai lớp chặn |
| Kiểm tra chất lượng | 129 test | 305 test + quy ước "chỉ test hàm thuần" |
| Triển khai | không nói nhánh nào | bảng nhánh + `git push deployrepo master:main` |
| Cấu trúc | dừng ở Phase 08 | cây thư mục hiện tại, gồm `(print)` và `lib/import` |

### Nhánh nào là bản đang chạy — chỗ dễ nhầm nhất

README trước đây không nói. Nhánh làm việc tại máy tên `master`, còn nhánh Vercel theo
dõi tên `main`, ở một remote khác. Người không biết sẽ gõ `git push deployrepo main` và
nhận lỗi `src refspec main does not match any`. Lệnh đúng đã ghi rõ vào README:

```bash
git push deployrepo master:main
```

## 27.5 Tài khoản Kế toán bị thiếu trong seed

`prisma/seed.ts` chỉ tạo 4 tài khoản, không có `ACCOUNTING` — trong khi đó là vai trò có
quyền tài chính **rộng nhất sau ADMIN** (sửa chi phí, sửa công nợ, xem lợi nhuận). Không
có tài khoản thì không ai thử được vai trò đó. Đã thêm `ketoan@cty.com`.

## 27.6 `.env.example`

Bổ sung nhóm `COMPANY_*` (thông tin công ty in trên báo giá / hợp đồng, thêm ở Phase 26).
Thiếu thì bản in chỉ hiện tên mặc định mà không ai biết vì sao.

---

## 27.7 Các file token trong lịch sử git — đánh giá lại

Bốn file cookie (`cookies.txt`, `c2.txt`, `ca.txt`, `cv.txt`) từng bị commit và **vẫn còn
trong lịch sử git**. Đây là món nợ ghi từ Phase 21.

**Đã kiểm chứng: toàn bộ token trong đó nay đã chết.** Chạy `jwtVerify` với `AUTH_SECRET`
hiện tại trên từng token trong cả 4 file:

```
c2.txt       JWT 251 ký tự -> ERR_JWS_SIGNATURE_VERIFICATION_FAILED
ca.txt       JWT 251 ký tự -> ERR_JWS_SIGNATURE_VERIFICATION_FAILED
cv.txt       JWT 256 ký tự -> ERR_JWS_SIGNATURE_VERIFICATION_FAILED
cookies.txt  JWT 251 ký tự -> ERR_JWS_SIGNATURE_VERIFICATION_FAILED
```

Việc xoay `AUTH_SECRET` (ngày 10/09/2026) đã vô hiệu hóa chúng. Không token nào còn mở
được phiên nào.

### Vì sao KHÔNG viết lại lịch sử git

`git filter-repo` + force-push lên cả hai remote sẽ **làm hỏng mọi bản clone đang có** —
ai đang có bản sao sẽ phải xóa đi lấy lại, và mọi tham chiếu commit cũ (trong hồ sơ
`plan/`, trong log CI) thành vô nghĩa.

Cái giá đó chỉ đáng trả khi bí mật **còn giá trị** — ví dụ khóa API của bên thứ ba không
xoay được. Với token phiên đã chết thì viết lại lịch sử **không mua thêm được gì**.

Quy trình đúng, đã ghi vào README: **xoay bí mật trước** (đó mới là bước cầm máu), rồi
mới cân nhắc chuyện dọn lịch sử. Bước 1 đã làm xong.

> Nếu anh/chị vẫn muốn xóa hẳn khỏi lịch sử vì lý do khác (ví dụ yêu cầu tuân thủ), việc
> đó làm được — nhưng cần **cho phép rõ ràng** vì nó viết lại lịch sử chung.

---

## 27.8 Kiểm thử end-to-end — làm được 2/5 kịch bản

`plan/24` để lại 5 kịch bản chưa chạy. Hai kịch bản không cần đăng nhập, đã chạy thật
trên dev server:

**✅ Kịch bản 4 — chống dò mật khẩu.** Gọi `/api/auth/login` 12 lần với một email
**không tồn tại** (`...@example.invalid`, không đụng tài khoản thật nào):

```
lần  1–10 -> 401
lần 11    -> 429  Retry-After: 900s
lần 12    -> 429  Retry-After: 900s
```

Đúng thiết kế: 10 lần sai trong 15 phút → chặn 15 phút, kèm `Retry-After`.

**✅ Route mới có bị chặn đăng nhập không.** Đây là rủi ro thật của Phase 26: hai trang
in nằm trong nhóm route **`(print)` mới**, ở ngoài `(app)`. Nếu `matcher` của `proxy.ts`
sót thì chúng thành trang công khai — mà trên đó có giá bán và giá trị hợp đồng.

| Đường dẫn | Kết quả |
|---|---|
| `/import` · `/reports` · `/audit` | 307 → `/login` |
| `/projects/…/quote/…/print` | 307 → `/login` |
| `/projects/…/contract/…/print` | 307 → `/login` |
| `/api/export/estimate/…` · `/api/reports/summary` | 307 → `/login` |
| `/api/cron/reminders` | 401 (tự bảo vệ bằng `CRON_SECRET`) |

**❌ Kịch bản 1, 2, 3, 5 — chưa chạy được.** Cả bốn đều cần **đăng nhập bằng tài khoản
thật** (phạm vi dự án, thu hồi phiên khi khóa tài khoản, so sánh tầm nhìn ADMIN). Tôi
không có mật khẩu, và không thử đoán mật khẩu tài khoản thật.

Bù lại, cả năm kịch bản nay đã thành **script chạy được** (xem 27.10) — anh/chị đặt tài
khoản vào `.env` rồi `npm run e2e` là xong, không phải làm thủ công từng bước.

## 27.9 CI — bỏ cảnh báo lặp lại và chỉnh phiên bản Node

Mỗi lần CI chạy đều kèm một cảnh báo:

> *Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced
> to run on Node.js 24: `actions/checkout@v4`, `actions/setup-node@v4`.*

Đã nâng cả hai lên **v5**.

Nhân tiện chỉnh `node-version` từ **20 → 22**. Lý do: Next 16 yêu cầu Node ≥ 20.9, nhưng
máy phát triển đang chạy **Node 24**. Để CI ở đúng mức sàn tối thiểu thì nó không còn
kiểm chứng đúng cái mà người ta thực sự chạy — một lỗi chỉ xuất hiện từ Node 22 trở lên
sẽ lọt qua CI rồi mới nổ trên Vercel.

> **Chưa động tới phiên bản Node của Vercel.** Repo không khai báo `engines.node` cũng
> không có `.nvmrc`, nên Vercel đang tự chọn. Ghim nó lại là một thay đổi ảnh hưởng thẳng
> tới bản build đang chạy, cần quyết định có chủ đích chứ không nên sửa kèm trong một
> commit dọn dẹp.

## 27.10 Biến 5 kịch bản thủ công thành `npm run e2e`

Năm kịch bản của `plan/24` nằm trong tài liệu suốt từ Phase 21 mà **chưa lần nào được
chạy** — vì mỗi lần chạy là một quy trình thủ công. Đã viết thành script chạy được:
`scripts/e2e-check.ts`.

**Không thêm Playwright/Cypress.** Năm kịch bản này kiểm **phân quyền ở tầng HTTP**, không
kiểm giao diện — chúng chỉ cần gọi request và đọc mã trạng thái. Thêm một bộ khung trình
duyệt vào đây là đắt mà không mua thêm được gì.

Script tự lo phần dựng bối cảnh: đọc DB (chỉ đọc) để tìm một dự án mà tài khoản thử
**không** được gán, rồi kiểm cả trang lẫn API. Kịch bản "báo cáo chỉ chứa dự án được gán"
phải mở file Excel trả về và soi từng mã dự án, vì `/api/reports/summary` trả về `.xlsx`
chứ không phải JSON.

Không có tài khoản thì script vẫn chạy kịch bản 4 và **bỏ qua** phần còn lại — chạy được
ngay, không phải cấu hình gì.

### Hai điều chỉ lộ ra khi thực sự chạy

**1. Thứ tự kịch bản sai.** Bản đầu tôi đặt kịch bản 4 (dò mật khẩu) lên trước vì nó
không cần tài khoản. Chạy thử thì hỏng ngay: bộ chặn đếm theo **IP**, nên 10 lần sai đó
làm chính máy đang chạy bị khóa 15 phút, và mọi lần đăng nhập của bốn kịch bản sau đều
nhận 429. Đã chuyển kịch bản 4 xuống **cuối cùng**.

**2. Chạy hai lần liên tiếp báo trượt oan.** Bộ chặn nằm trong bộ nhớ tiến trình, nên lần
chạy thứ hai trong vòng 15 phút bị chặn ngay từ request đầu. Đó là trạng thái môi trường,
không phải lỗi mã. Script giờ nhận ra trường hợp này và báo **bỏ qua** kèm cách xử lý.

Cả hai đều là lỗi của chính script, và cả hai chỉ lộ ra vì đã chạy thật thay vì viết xong
rồi tin là nó đúng.

### Kịch bản 3 có ghi vào DB

Khóa tài khoản là một thao tác **ghi**, nên mặc định bị bỏ qua; bật bằng
`E2E_ALLOW_MUTATE=1`. Script mở khóa lại trong khối `finally` để dù kiểm thất bại thì tài
khoản vẫn được trả về nguyên trạng.

`tokenVersion` **cố ý không hạ lại** — trường này chỉ được phép tăng; hạ lại là làm sống
lại đúng những token mà thao tác khóa vừa giết.

---

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 vấn đề |
| `npm test` | ✅ 305/305 |
| Xóa nhánh `deploy` bằng `-d` | ✅ git xác nhận không mất commit nào |
| Token cũ trong lịch sử git | ✅ đã chết, kiểm bằng `jwtVerify` |
| Chặn đăng nhập trên route mới | ✅ 7/7 đường dẫn |
| Chống dò mật khẩu | ✅ 429 + `Retry-After: 900` sau 10 lần |
| `npm run e2e` chạy không cần tài khoản | ✅ đạt 1, bỏ qua 4, không trượt |
| `npm run e2e` chạy lại ngay lần hai | ✅ báo bỏ qua đúng, không trượt oan |
| CI trên Node 22 với actions v5 | ✅ xanh, không còn cảnh báo deprecated |

## Việc còn lại của cả bản rà soát

1. **Kiểm thử 4 kịch bản còn lại** — cần một tài khoản để đăng nhập.
2. **Xem giao diện trên trình duyệt thật** — `/import`, `/reports`, hộp `Ctrl+K`, hai
   trang in. Phần logic đều đã chạy trên dữ liệu thật, nhưng chưa ai nhìn thấy chúng.
3. **Nhập ngày thực thu / thực trả** cho các đợt thanh toán — nếu không, mọi ô dòng tiền
   trong Báo cáo theo kỳ vẫn bằng 0 (đã phát hiện ở Phase 26).
4. Tùy chọn: chuyển `MKT.LANDINGPAGE.SKILLS-main/` ra khỏi thư mục dự án (27.3).
