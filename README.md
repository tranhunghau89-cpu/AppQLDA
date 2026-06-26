# QLDA — Web Quản lý Dự án Kết cấu thép

Web nội bộ quản lý dự án thi công kết cấu thép: trạng thái dự án, chủ đầu tư & nhà cung cấp,
tiến độ, dự toán – chi phí – lợi nhuận, và phân quyền theo bộ phận. Thay cho 2 file Excel
`TD_DA.xlsx` (sổ theo dõi) và `K20L20_TQ.xlsx` (dự toán).

## Công nghệ
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + Recharts (biểu đồ) + lucide-react (icon)
- **Prisma 6** + **SQLite** (dev) — đổi sang PostgreSQL khi lên cloud (sửa `provider` trong `prisma/schema.prisma`)
- Auth tự xây nhẹ: `jose` (JWT) + `bcryptjs` + cookie httpOnly + middleware
- **ExcelJS** — import/export Excel

## Chạy lần đầu
```bash
npm install
npx prisma migrate dev      # tạo DB + bảng
npm run db:seed             # tạo 4 user + dữ liệu mẫu
npm run dev                 # http://localhost:3000
```

### Tài khoản mẫu (mật khẩu: `123456`)
| Email | Vai trò |
|-------|---------|
| admin@cty.com | Ban giám đốc / Quản lý (toàn quyền) |
| sales@cty.com | Kinh doanh / CĐT |
| kythuat@cty.com | Kỹ thuật / Thiết kế |
| vattu@cty.com | Vật tư / Mua hàng |

## Nhập dữ liệu thật từ Excel
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
- **Chủ đầu tư / Nhà cung cấp**: CRUD, phân loại NCC.
- **Người dùng** (ADMIN): quản lý tài khoản + vai trò.

## Phân quyền (tóm tắt)
| Bộ phận | Dự án | Tiến độ | Dự toán | HĐ/Báo giá | Đơn hàng | Lợi nhuận | CĐT | NCC | User |
|---|---|---|---|---|---|---|---|---|---|
| BGĐ/Quản lý | Sửa | Sửa | Sửa | Sửa | Sửa | Xem | Sửa | Sửa | Sửa |
| Kinh doanh | Sửa | Xem | Xem | Sửa | Xem | Xem | Sửa | Xem | – |
| Kỹ thuật | Sửa | Sửa | Xem | Xem | Xem | – | Xem | Xem | – |
| Vật tư | Xem | Xem | Sửa | Xem | Sửa | – | – | Sửa | – |

**Tổng hợp chi phí (quyết toán)**: BGĐ sửa; Kinh doanh + Vật tư xem; Kỹ thuật không truy cập.

Ma trận chi tiết ở `src/lib/rbac.ts`.

## Build & triển khai nội bộ
```bash
npm run build
npm start                   # chạy server production trên LAN
```
Lên cloud: đổi datasource sang PostgreSQL, đặt `AUTH_SECRET` ngẫu nhiên trong biến môi trường,
`npx prisma migrate deploy`, rồi deploy (VPS/Vercel).

## Cấu trúc
```
src/
├── app/
│   ├── (app)/            ← khu vực đã đăng nhập (sidebar)
│   │   ├── page.tsx      ← dashboard
│   │   ├── projects/     ← dự án + chi tiết + dự toán
│   │   ├── weekly/       ← tiến độ tuần
│   │   ├── estimates/    ← tổng hợp dự toán
│   │   ├── customers/ suppliers/ users/
│   ├── login/  api/auth/  api/export/
├── components/ui/  components/layout/
└── lib/                  ← db, auth, rbac, constants, profit, week
plan/                     ← plan từng phase (00→08)
scripts/import-excel.ts
```
