# QLDA — Web Quản lý Dự án Kết cấu thép

Web nội bộ quản lý dự án thi công kết cấu thép: trạng thái dự án, chủ đầu tư & nhà cung cấp,
tiến độ, dự toán – chi phí – lợi nhuận, và phân quyền theo bộ phận. Thay cho 2 file Excel
`TD_DA.xlsx` (sổ theo dõi) và `K20L20_TQ.xlsx` (dự toán).

## Công nghệ
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + Recharts (biểu đồ) + lucide-react (icon)
- **Prisma 6** + **PostgreSQL** (Supabase, vùng Tokyo `ap-northeast-1`)
- Auth tự xây nhẹ: `jose` (JWT) + `bcryptjs` + cookie httpOnly + `src/proxy.ts`
- **ExcelJS** — nhập/xuất Excel

> Next 16 đổi `middleware.ts` thành **`proxy.ts`**. Trước khi sửa code Next, đọc
> `node_modules/next/dist/docs/` — bản này có nhiều thay đổi phá vỡ so với Next 14/15.

## Chạy lần đầu
```bash
npm install
cp .env.example .env        # rồi điền DATABASE_URL + AUTH_SECRET
npx prisma migrate deploy   # áp 12 migration lên DB
npm run db:seed             # tạo 4 user + dữ liệu mẫu
npm run dev                 # http://localhost:3000
```

> ⚠️ Dùng `migrate deploy`, **không** dùng `migrate dev`, trừ khi anh/chị đang trỏ vào
> một DB dùng riêng để phát triển. `migrate dev` có thể **xóa và dựng lại** cơ sở dữ
> liệu khi thấy lịch sử migration lệch — trỏ nhầm vào DB thật là mất sạch.

### Tài khoản mẫu (chỉ dùng cho môi trường dev)
`npm run db:seed` tạo sẵn các tài khoản dưới đây với **mật khẩu mặc định dùng cho phát triển cục bộ**.

| Email | Vai trò |
|-------|---------|
| admin@cty.com | Ban giám đốc / Quản lý (toàn quyền) |
| sales@cty.com | Kinh doanh / CĐT |
| kythuat@cty.com | Kỹ thuật / Thiết kế |
| vattu@cty.com | Vật tư / Mua hàng |
| ketoan@cty.com | Kế toán / Tài chính |

> ⚠️ **Bảo mật production:** KHÔNG dùng mật khẩu seed mặc định trên môi trường thật.
> Sau khi deploy, đăng nhập bằng tài khoản quản trị và **đổi mật khẩu tất cả tài khoản** trong mục
> **Người dùng** (`/users`). Không ghi mật khẩu thật vào repo/README.

## Nhập dữ liệu thật từ Excel

> **Ba loại dùng thường xuyên nhất — Dự toán, Tổng hợp chi phí, Đơn đặt hàng — nay nhập
> thẳng trên web tại `/import`** (Phase 26), có bước **xem trước** trước khi ghi. Các lệnh
> CLI dưới đây vẫn chạy được và là cách duy nhất cho những loại còn lại (hợp đồng, bảng
> đơn giá, báo giá mẫu) — đó đều là việc làm một lần lúc dựng dữ liệu.
>
> Bản web an toàn hơn ở hai điểm: cho **xem trước rồi mới ghi**, và bọc `$transaction`
> quanh thao tác xóa-rồi-ghi-lại nên lỗi giữa chừng không để lại dữ liệu trống.

Đặt `TD_DA.xlsx` ở thư mục cha (cùng cấp `AppQLDA`) rồi:
```bash
npm run import              # nhập 56 dự án + CĐT + NCC từ sheet TongHop (chạy lại không nhân đôi)
```

### Nhập dự toán chi tiết
Đặt các file dự toán (mỗi file 1 dự án, sheet `TongHop`) vào `AppQLDA/DuToanMau/` rồi:
```bash
npm run import:estimates   # nhập từng dòng vật tư + diện tích + giá bán; khớp dự án theo tên, tạo mới nếu chưa có
```
- Tổng chi phí được tính lại từ các dòng item (cột `I1`/`J1` trong Excel thường stale).
- Khớp dự án an toàn: chỉ gắn vào dự án có sẵn khi tên (hoặc phần `K..L..`) trùng khít; khác hậu tố địa điểm → tạo dự án mới (`DT01…`).
- Chạy lại không nhân đôi (thay toàn bộ item của dự án đích).

### Nhập hợp đồng & báo giá
```bash
npm run import:contracts   # 7 hợp đồng thật (OCR từ PDF/docx) + báo giá theo hạng mục từ dự toán
```
- Hợp đồng đã ký: số HĐ, ngày, CĐT, điều khoản thanh toán, **đường dẫn file** (mở qua API stream), dòng hạng mục, giá trị chưa VAT / VAT 8% / tổng.
- Báo giá theo hạng mục lấy từ phần đầu sheet `TongHop` (nhóm A–E × diện tích × đơn giá bán/m²); cập nhật `salePrice` đúng (vd PickLang 2,83 tỷ thay vì giá trị lỗi).
- Chạy lại không nhân đôi (thay toàn bộ HĐ của dự án đích).

### Nhập tổng hợp chi phí (quyết toán)
Đặt các file THCP (mỗi file 1 dự án) vào `AppQLDA/THCPMau/*.xlsx` rồi:
```bash
npm run import:thcp        # nhập doanh thu/chi phí/LNTT + hạng mục (NCC/giá trị/thanh toán/hóa đơn) + chi tiết
```
- Khớp dự án theo tên + tỉnh; không khớp → tạo dự án mới (vd Ba Vì K20L50_HN).
- Cập nhật `salePrice` = doanh thu; dashboard ưu tiên số liệu quyết toán (doanh thu/chi phí/lợi nhuận thực tế).
- Chạy lại không nhân đôi (thay toàn bộ quyết toán của dự án đích).

### Nhập bảng đơn giá & báo giá chi tiết
File nguồn: `…/RaDonHang/@CN/BG_NX_KL_HN_D2504_23.xlsx` (sheet `DV` = danh mục đơn giá, `BG CT` = báo giá chi tiết).
```bash
npm run import:pricebook   # nạp 135 mã công việc (Mã CV) + giá thành = (VT+NC)×HS vào Bảng đơn giá
npm run import:quote       # nạp báo giá mẫu (BG CT) thành 1 báo giá trên dự án demo (DEMO1)
```
- **Bảng đơn giá (`/catalog`)**: danh mục công việc dùng chung, gom theo nhóm AA…AL; sửa vật tư/nhân công/hệ số → tự tính giá thành.
- **Báo giá chi tiết (`/projects/[id]/quote`)**: lập báo giá theo Mã CV (Phần A/B/… + mục I/II), khối lượng × đơn giá → thành tiền, tổng giá bán/giá gốc/lợi nhuận.
  - Chọn Mã CV từ bảng đơn giá → tự điền tên/đơn vị/giá gốc; **đơn giá bán = giá gốc × hệ số TL**.
  - **Tạo từ dự án khác**: sao chép cấu trúc + khối lượng từ báo giá cũ rồi lấy lại đơn giá mới nhất từ bảng đơn giá.
  - **Cập nhật đơn giá**: refresh giá gốc toàn bộ dòng từ catalog. **Đẩy giá bán**: ghi tổng báo giá vào `salePrice` dự án (thủ công).
- Chạy lại không nhân đôi (pricebook upsert theo mã; quote thay toàn bộ báo giá của dự án demo).

### Nhập đơn đặt hàng (mua hàng)
Đặt file đơn vào `...RaDonHang/<dự án>/MH/<ngày>_DH_<BL|TON>_<mã>.xlsx` rồi:
```bash
npm run import:orders      # bóc chi tiết từng dòng vật tư từ file đơn nhiều sheet
```
- Mỗi file = 1 đơn (BL/Tôn…); parse **theo nhãn cột** (fold dấu) nên ổn định dù mỗi sheet khác cấu trúc.
- Theo dõi NCC + trạng thái (Nháp/Đã đặt/Đã nhận) + giá trị + trọng lượng; mở file đơn từ web.
- **Hình biên dạng**: ảnh quy cách nhúng trong file (diềm, tôn vòm, máng xối…) được trích, gắn vào đúng dòng vật tư (lưu trong DB), hiện thumbnail trong trang đơn hàng. Có thể **tự upload thêm / xóa** ảnh biên dạng cho từng dòng ngay trên web.
- **Gom & sắp xếp**: đổi cách gom vật tư (theo Nhóm vật tư / theo Hạng mục) và bấm tiêu đề cột (SL, Đơn giá, TL…) để sắp xếp tăng/giảm.
- **Tab theo nhóm**: mỗi đơn chia tab theo nhóm vật tư + tab **Tổng hợp** (bảng tóm tắt theo nhóm: số dòng/khối lượng/giá trị + toàn bộ vật tư gộp).
- Chạy lại không nhân đôi (thay đơn theo dự án + loại).

## Tính năng theo module
- **Tổng quan**: thẻ thống kê, biểu đồ trạng thái & giá bán/chi phí, dự án cập nhật gần đây.
- **Dự án**: danh sách lọc/tìm, chi tiết, đổi trạng thái, gán NCC theo hạng mục, xuất Excel.
- **Tiến độ tuần**: nhật ký theo tuần (thay sheet TDDA_Tuan).
- **Dự toán & chi phí**: nhập KL/đơn giá theo nhóm → tổng chi phí, lợi nhuận, biên LN, CP/m²; xuất Excel.
- **Hợp đồng & Báo giá**: quản lý HĐ theo từng hạng mục (đơn giá bán × KL), trạng thái Báo giá/Đã ký/Thanh lý, VAT, điều khoản thanh toán, mở file HĐ đã ký.
- **Đơn hàng & Mua hàng**: đơn đặt hàng vật tư gửi NCC, chi tiết từng dòng (quy cách/SL/trọng lượng), trạng thái Đã đặt/Đã nhận, mở file đơn.
- **Tổng hợp chi phí (quyết toán)**: doanh thu, chi phí, LNTT, đã thu/đã chi/còn phải thu; bảng hạng mục (NCC/giá trị/thanh toán/hóa đơn) + chi tiết chi phí từng dòng; cập nhật dashboard.
- **Đơn giá & Báo giá chi tiết**: bảng đơn giá theo Mã CV dùng chung; lập báo giá chi tiết theo dự án (Phần/Mục/dòng), tổng giá bán/giá gốc/lợi nhuận; clone từ báo giá cũ + cập nhật đơn giá; đẩy giá bán sang dự án.
- **Công nợ**: tổng hợp tự động (chỉ đọc) — phải thu theo **chủ đầu tư** (giá trị HĐ/doanh thu − đã thu; nguồn: quyết toán → hợp đồng → giá bán) và phải trả theo **nhà cung cấp** (giá trị quyết toán − đã trả, khớp tên NCC; đơn hàng theo FK). Trang `/debts` có thẻ tổng + bảng bung chi tiết theo dự án; cột công nợ cũng nhúng trong trang Chủ đầu tư / Nhà cung cấp. *Đã trả vượt giá trị (gồm VAT) ⇒ coi như tất toán (còn phải trả = 0).*
- **Chủ đầu tư / Nhà cung cấp**: CRUD, phân loại NCC.
- **Nhập từ Excel** (`/import`, ADMIN): tải file lên → **xem trước** → xác nhận ghi. Hỗ trợ
  Dự toán, Tổng hợp chi phí (quyết toán) và Đơn đặt hàng. Bước xem trước chỉ ĐỌC file,
  chưa ghi gì vào DB.
- **Báo cáo theo kỳ** (`/reports`): tháng/quý/năm — tiền đã thu/chi, dòng tiền ròng, HĐ ký
  mới, đơn hàng, mốc hoàn thành, dự án khởi công/hoàn thành, kèm % so kỳ trước.
- **Nhật ký thay đổi** (`/audit`, ADMIN): ai đổi gì lúc nào trên dự án, hợp đồng, báo giá,
  đợt thanh toán, đơn giá. Thẻ "Lịch sử thay đổi" trên trang dự án chỉ hiện với vai trò
  xem được lợi nhuận.
- **Tìm kiếm toàn cục** (`Ctrl+K`): dự án, CĐT, NCC, hợp đồng, báo giá, mã đơn giá. **Gõ
  không dấu vẫn ra** — "ha nam" tìm thấy "Hà Nam".
- **In / Xuất PDF**: báo giá và hợp đồng có trang in riêng (khổ A4, có dòng "Bằng chữ").
  Bấm **In / PDF** rồi chọn *Lưu thành PDF* trong hộp thoại in của trình duyệt.
- **Nhắc việc hằng ngày**: Vercel Cron gọi `/api/cron/reminders` lúc 08:00 giờ VN — mốc trễ
  hạn, đợt thanh toán quá hạn / sắp tới hạn.
- **Người dùng** (ADMIN): quản lý tài khoản + vai trò.

## Phân quyền (tóm tắt)
| Bộ phận | Dự án | Tiến độ | Dự toán | HĐ/Báo giá | Đơn hàng | Lợi nhuận | CĐT | NCC | User |
|---|---|---|---|---|---|---|---|---|---|
| BGĐ/Quản lý | Sửa | Sửa | Sửa | Sửa | Sửa | Xem | Sửa | Sửa | Sửa |
| Kinh doanh | Sửa | Xem | Xem | Sửa | Xem | Xem | Sửa | Xem | – |
| Kỹ thuật | Sửa | Sửa | Xem | Xem | Xem | – | Xem | Xem | – |
| Vật tư | Xem | Xem | Sửa | Xem | Sửa | – | – | Sửa | – |
| Kế toán | Xem | – | Xem | Xem | Xem | Xem | Xem | Xem | – |

**Tổng hợp chi phí (quyết toán)**: BGĐ sửa; Kinh doanh + Vật tư xem; Kỹ thuật không truy cập.

**Đơn giá & Báo giá chi tiết**: BGĐ + Kinh doanh sửa; Vật tư + Kỹ thuật xem.

**Công nợ**: BGĐ + Kinh doanh + Vật tư + Kế toán xem (chỉ đọc); Kỹ thuật không truy cập.

**Nhập từ Excel** và **Nhật ký thay đổi**: chỉ BGĐ/Quản lý.

**Báo cáo theo kỳ**: theo quyền `cost` — BGĐ, Kinh doanh, Vật tư, Kế toán; Kỹ thuật không
truy cập.

Ma trận chi tiết ở `src/lib/rbac.ts`.

### Phạm vi dự án — lớp chặn thứ hai
RBAC quyết định **loại dữ liệu** nào được xem; `ProjectMember` quyết định **dự án nào**.
Hai lớp này độc lập và đều bắt buộc: một người Kinh doanh xem được hợp đồng, nhưng chỉ
hợp đồng của dự án họ được gán. Áp cho cả trang danh sách, trang chi tiết, ô tìm kiếm
`Ctrl+K` và báo cáo theo kỳ.

## Kiểm tra chất lượng
```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest — 305 test: logic tài chính, RBAC, bóc Excel, đọc tiền
                    # thành chữ, tìm kiếm, mốc kỳ báo cáo
```
CI (`.github/workflows/ci.yml`) chạy đủ 4 bước typecheck → lint → test → build trên mỗi PR
và mỗi lần push `master`.

Quy ước test: chỉ test **hàm thuần**. Các module bóc Excel được tách đôi — phần thuần
(`*-parse.ts`, không khai báo `server-only`) chạy được trong Vitest và trong script `tsx`
kiểm chứng ngoài Next; phần chạm DB nằm ở file riêng.

## Bảo mật
- **Phạm vi dự án**: user không phải ADMIN chỉ thấy dự án được gán qua `ProjectMember`
  (mục "Thành viên dự án" trong trang chi tiết dự án). Người mới **chưa được gán sẽ không
  thấy dự án nào** — dùng `npm run members:backfill` để gán hàng loạt khi mới bật.
- **Thu hồi phiên**: khóa tài khoản / đổi mật khẩu / đổi vai trò tăng `User.tokenVersion`,
  cắt mọi phiên đang mở ngay lần điều hướng kế tiếp.
- **Chống dò mật khẩu**: 10 lần sai (theo IP hoặc email) trong 15 phút → chặn 15 phút.
- **Nhật ký thay đổi**: mọi thay đổi giá bán, giá trị hợp đồng, đợt thanh toán, đơn giá đều
  ghi `AuditLog` (ai, lúc nào, trước → sau). Chỉ ADMIN đọc được ở `/audit`.
- **Endpoint cron** (`/api/cron/reminders`) đi vòng qua đăng nhập vì Vercel Cron không gửi
  cookie. Bù lại route tự bảo vệ: **chưa đặt `CRON_SECRET` thì từ chối MỌI request**, sai
  secret trả 401.

### Biến môi trường
Danh sách đầy đủ kèm chú thích ở **`.env.example`**. Bắt buộc: `DATABASE_URL`,
`DIRECT_URL`, `AUTH_SECRET`. Cần cho từng tính năng: `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` (lưu file), `CRON_SECRET` (nhắc việc), `COMPANY_*` (in báo giá).

`.env` nằm trong `.gitignore` — **không bao giờ commit giá trị thật**.

### KHÔNG commit token/bí mật
Nếu lỡ commit, làm theo thứ tự sau — **bước 1 mới là bước cầm máu**:

1. **Xoay bí mật ngay.** Sinh mới rồi cập nhật trên Vercel và redeploy:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AUTH_SECRET
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
   ```
   Xoay `AUTH_SECRET` làm **mọi JWT cũ mất hiệu lực ngay**, kể cả token đã lộ ra ngoài.
   Mọi người phải đăng nhập lại — đó là cái giá phải trả và nó rẻ.
2. **Rồi mới tính chuyện dọn lịch sử git.** Viết lại lịch sử (`git filter-repo` +
   force-push) sẽ làm hỏng mọi bản clone đang có, nên chỉ làm khi bí mật còn giá trị —
   ví dụ khóa API của bên thứ ba không xoay được. Với token phiên đã chết sau bước 1
   thì đây chỉ là dọn dẹp, không phải xử lý sự cố.

> Các file cookie phiên (`cookies.txt`, `c2.txt`, `ca.txt`, `cv.txt`) từng bị commit
> nhầm và **vẫn còn trong lịch sử git**. `AUTH_SECRET` đã được xoay ngày 10/09/2026 nên
> toàn bộ token trong đó đã hết hiệu lực (kiểm chứng: chữ ký không còn verify được).
> Cả 4 tên file đã nằm trong `.gitignore`.

## Build & triển khai nội bộ
```bash
npm run build       # prisma generate + next build — KHÔNG chạm DB
npm run db:deploy   # prisma migrate deploy — áp migration lên DB thật (chạy riêng, có chủ đích)
npm start           # chạy server production trên LAN
```
> Trên Vercel, script `vercel-build` (generate + migrate deploy + build) được ưu tiên,
> nên deploy vẫn tự áp migration như trước.

### Nhánh nào là bản đang chạy
| Remote | Nhánh | Vai trò |
|---|---|---|
| `deployrepo` | **`main`** | **Bản đang chạy.** Vercel theo dõi nhánh này và tự deploy. |
| `origin` | `master` | Bản sao dự phòng, không tự deploy. |

Nhánh làm việc tại máy là **`master`**, nên lệnh đẩy bản deploy phải nêu rõ hai tên:

```bash
git push deployrepo master:main
```

CI chạy trên nhánh `main` của `deployrepo`; xong mới tới lượt Vercel deploy.

> Nhánh `deploy` cũ đã bị xóa ở Phase 27 — nó tụt 33 commit sau `master` và không có
> commit nào của riêng nó, giữ lại chỉ gây nhầm với `deployrepo/main`.

## Cấu trúc
```
src/
├── proxy.ts              ← chặn đăng nhập toàn site (Next 16 gọi tên này, không phải middleware.ts)
├── app/
│   ├── (app)/            ← khu vực đã đăng nhập, có sidebar + thanh trên
│   │   ├── page.tsx      ← dashboard
│   │   ├── projects/     ← dự án, chi tiết, dự toán, hợp đồng, báo giá, mua hàng
│   │   ├── weekly/ gantt/            ← tiến độ tuần, kế hoạch
│   │   ├── estimates/ costs/ debts/  ← dự toán, quyết toán, công nợ
│   │   ├── contracts/ quotes/ catalog/
│   │   ├── import/       ← nhập Excel qua web (Phase 26)
│   │   ├── reports/      ← báo cáo theo kỳ (Phase 26)
│   │   ├── audit/        ← nhật ký thay đổi (Phase 25)
│   │   ├── customers/ suppliers/ users/ tools/ approvals/ estimate-templates/
│   ├── (print)/          ← trang in báo giá / hợp đồng, CỐ Ý không dùng AppShell
│   ├── login/  api/auth/  api/export/  api/cron/
├── components/
│   ├── layout/           ← AppShell, Sidebar, Topbar, GlobalSearch (Ctrl+K)
│   ├── print/            ← khung trang in dùng chung
│   ├── audit/  ui/
└── lib/
    ├── import/           ← bóc Excel: cells + 3 cặp *-parse.ts / *.ts
    ├── auth · rbac · scope · session · rate-limit     ← bảo mật
    ├── profit · contract · quote · debt · payments    ← nghiệp vụ tài chính
    ├── audit · reminders · period · search · money-words
    └── db · storage · text · utils · now · company
plan/                     ← hồ sơ từng phase (00 → 28)
scripts/                  ← 10 script CLI (3 bộ nhập đã chuyển lên web ở Phase 26)
```
