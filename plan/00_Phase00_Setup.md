# Phase 00 — Khởi tạo dự án (Setup)

## Mục tiêu
Dựng nền tảng chạy được: Next.js 16 (App Router, TS) + Tailwind v4 + Prisma/SQLite + auth nhẹ + layout/sidebar + trang đăng nhập + seed 4 user.

## Stack thực tế (chốt lúc cài)
- Next.js **16.2.9**, React **19.2.4**, Tailwind **v4**, TypeScript 5
- Prisma **7.8** + SQLite (dev)
- Auth: **tự xây nhẹ** — `jose` (JWT) + `bcryptjs` (hash) + httpOnly cookie + `middleware.ts`. *Lý do: tránh xung đột peer-dep của NextAuth v5 với Next 16/React 19.*
- Excel: **ExcelJS** (thay SheetJS — bảo trì tốt, không advisory)
- UI: Tailwind + `clsx`+`tailwind-merge` (hàm `cn`), `lucide-react` (icon), `recharts` (chart). Tự viết primitive (Button/Input/Card/Table/Badge) — không dùng shadcn CLI để tránh ma sát trên bản mới.

## File tạo/sửa
- `prisma/schema.prisma` — tạm: model `User` (đủ để đăng nhập). Schema đầy đủ ở Phase 01.
- `.env` — `DATABASE_URL="file:./dev.db"`, `AUTH_SECRET=...`
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/auth.ts` — tạo/verify JWT, `getSession()`, `hashPassword`/`verifyPassword`
- `src/lib/rbac.ts` — enum Role + ma trận quyền (khung, dùng dần)
- `src/lib/utils.ts` — `cn()`, format tiền VND, format ngày
- `src/middleware.ts` — chặn route chưa đăng nhập, gắn role
- `src/app/login/page.tsx` + `src/app/api/auth/login/route.ts` + `logout`
- `src/components/ui/*` — Button, Input, Card, Badge, Table primitives
- `src/components/layout/Sidebar.tsx`, `Topbar.tsx`
- `src/app/(app)/layout.tsx` — layout có sidebar cho khu vực đã đăng nhập
- `src/app/(app)/page.tsx` — dashboard tạm (placeholder)
- `prisma/seed.ts` — 4 user: admin@cty / sales@cty / kythuat@cty / vattu@cty (mật khẩu `123456`)

## Kiến trúc
- Route group `(app)` = khu vực cần đăng nhập (có sidebar). `login` nằm ngoài.
- `middleware.ts` đọc cookie JWT → chưa có thì redirect `/login`. Role đính trong JWT.
- Server Components đọc DB trực tiếp qua `db`; mutation qua Server Actions (Phase sau).

## Verification
1. `npm run dev` → mở `/login`, đăng nhập admin → vào `(app)` thấy sidebar.
2. Sai mật khẩu → báo lỗi, không vào được.
3. Truy cập thẳng `/` khi chưa đăng nhập → bị đẩy về `/login`.
4. `npx prisma studio` thấy 4 user đã seed.
5. `npm run build` không lỗi TypeScript.
