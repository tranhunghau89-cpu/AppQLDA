# Phase 18 — Triển khai cloud: Supabase (DB + Storage) + Vercel + tên miền

## Quyết định (đã chốt với user)
- **Host app**: Vercel (free, tự build khi push GitHub `hungsvkt95-bit/AppQLDA`).
- **DB**: Supabase PostgreSQL (thay SQLite).
- **File HĐ/đơn hàng**: chuyển lên **Supabase Storage** (thay `filePath` ổ đĩa local).
- **Domain**: user đã có sẵn (sẽ trỏ DNS sang Vercel).
- Auth giữ nguyên (jose JWT tự xây) — KHÔNG dùng Supabase Auth.

## Kiến trúc
```
Vercel (Next.js)  ──Prisma──▶  Supabase Postgres
   │                              Supabase Storage (bucket: project-files)
domain của user (CNAME → Vercel)
```

## Các bước

### A. Supabase (user tạo, gửi lại secrets)
1. Tạo project Supabase (region Singapore gần VN nhất). Đặt mật khẩu DB mạnh.
2. Lấy 2 connection string (Settings → Database):
   - **Pooled** (Transaction, port 6543) → `DATABASE_URL` (thêm `?pgbouncer=true&connection_limit=1`).
   - **Direct** (port 5432) → `DIRECT_URL` (cho migrate).
3. Lấy `Project URL` + `service_role key` (Settings → API) → cho script upload Storage + tạo signed URL.
4. Tạo bucket Storage **`project-files`** (Private).

### B. Code — chuyển Prisma sang Postgres
- `schema.prisma`: `provider = "postgresql"`, thêm `directUrl = env("DIRECT_URL")`.
- Xóa `prisma/migrations/*` (SQLite-specific) → tạo lại `migrate dev --name init` trên Postgres.
- `Bytes` (PoItemImage.data) → Postgres `bytea` tự động, OK.
- Build script: `prisma generate && prisma migrate deploy && next build` (để Vercel chạy migrate khi deploy). Thêm `postinstall: prisma generate`.

### C. Code — file lên Supabase Storage
- Thêm `src/lib/storage.ts` (supabase-js, service role, server-only): `uploadFile(key, buffer, mime)`, `signedUrl(key)`.
- Sửa API `/api/contracts/[id]/file` + `/api/purchases/[id]/file`: nếu `filePath` là key Storage → redirect signed URL; (giữ fallback đọc disk khi chạy local).
- Script `scripts/migrate-files-to-storage.ts`: duyệt Contract/PurchaseOrder có `filePath` local còn tồn tại → upload lên bucket, cập nhật `filePath` = key Storage. Chạy 1 lần ở máy user (còn file gốc).

### D. Chuyển dữ liệu sang Postgres
- Cách chọn: **chạy lại pipeline idempotent** trên DB Postgres (đã được thiết kế chạy lại không nhân đôi):
  `db:seed` → `import` → `import:estimates` → `import:contracts` → `import:orders` → `import:thcp` → `import:pricebook` → `import:quote` → `migrate-files-to-storage`.
- (Phương án phụ: dump SQLite → Postgres nếu có sửa tay không tái tạo được.)

### E. Vercel
1. Import repo `hungsvkt95-bit/AppQLDA`, framework Next.js (root = repo root).
2. Env vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (ngẫu nhiên 32+ ký tự), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. Kiểm tra build chạy `migrate deploy` OK.

### F. Tên miền
- Vercel → Project → Settings → Domains → add domain của user.
- Trỏ DNS tại nhà cung cấp domain: `www` CNAME → `cname.vercel-dns.com`; apex `@` → A `76.76.21.21` (hoặc theo hướng dẫn Vercel). Chờ propagate + Vercel tự cấp HTTPS.

### G. Bảo mật (bắt buộc trước khi mở công khai)
- Đổi mật khẩu admin khỏi `123456` (đổi seed hoặc đổi trong app).
- `AUTH_SECRET` ngẫu nhiên (KHÔNG commit).
- `.env*` đã trong `.gitignore` (đã có).
- Bucket Storage để Private, chỉ truy cập qua signed URL từ server.

## Verification
- `prisma migrate deploy` thành công trên Supabase (xem bảng trong Supabase Table editor).
- Đăng nhập trên domain thật, RBAC đúng, dashboard có số (dữ liệu đã import).
- Mở 1 file HĐ + 1 ảnh biên dạng trên cloud OK.
- HTTPS hợp lệ (ổ khóa xanh) trên domain.

## Lưu ý
- Đổi provider Prisma sẽ làm app **local SQLite ngừng chạy** → chỉ cut over khi Supabase sẵn sàng; làm trên nhánh `deploy` để an toàn, merge sau khi chạy được.
- Next 16 + Prisma trên Vercel: cần `prisma generate` trong `postinstall`/build, nếu không sẽ lỗi "PrismaClient is unable to run in browser/edge" hoặc thiếu engine.
