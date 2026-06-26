# Phase 16 — Module Đơn giá & Báo giá chi tiết

## Mục tiêu
Số hóa quy trình báo giá/dự toán chi tiết của công ty từ file `BG_NX_KL_HN_D2504_23.xlsx`:
- **Lưu đơn giá**: bảng danh mục công việc & đơn giá (Mã CV) dùng chung mọi dự án — *catalog*.
- **Lưu khối lượng + báo giá theo dự án**: mỗi dự án có 1+ báo giá chi tiết, dòng vật tư tham chiếu Mã CV.
- **Clone từ dự án cũ**: tạo báo giá mới bằng cách sao chép cấu trúc + khối lượng từ báo giá cũ, **kéo lại đơn giá mới nhất từ catalog**, áp hệ số TL → ra bảng báo giá/dự toán mới.

Quyết định người dùng (chốt qua hỏi đáp):
- Phạm vi: **trọn gói** (catalog + builder + clone + import).
- Đặt: **module mới bổ sung**, KHÔNG đụng Dự toán/Hợp đồng/THCP.
- Hệ số TL mặc định **1.0** (đơn giá bán = giá gốc × TL; sửa được mỗi báo giá). Riêng BG mẫu import giữ nguyên đơn giá bán thật trong file + TL=1.2.
- BG mẫu (sheet BG CT) → gắn vào **1 dự án demo** mới tạo.
- salePrice/dashboard: **nối thủ công** — chỉ nút bấm, không tự động.

## Nguồn dữ liệu (đã phân tích)
File `…/2_DuAn/RaDonHang/@CN/BG_NX_KL_HN_D2504_23.xlsx`:
- **Sheet `DV`** = catalog. Cột (Excel): A=STT, B=MCV, C=ND(tên), D=Loại, E=TSKT, F=DV(đơn vị), G=VT(vật tư), H=NC_M(nhân công+máy), I=HS(hệ số), J=GT(giá thành), K=GC. **135 mã / 9 nhóm** AA,AB,AC,AD,AE,AF,AG,AK,AL. Công thức: `GT = (VT + NC_M) × HS`.
- **Sheet `BG CT`** = báo giá chi tiết 1 dự án. Header báo giá ở rows 8–17 (kính gửi/dự án/địa điểm/hạng mục). Bảng từ row 44: A=STT(A/B/I/II/1…), B=ND, C=MCV, D=ĐV, E=Khối lượng, F=Đơn giá bán, G=Thành tiền bán, H=Quy cách, J=Giá gốc, K=Thành tiền gốc. Row 43: `TL 1.2`. Nhóm Phần **A–F**: A Khung&mái, B Hệ dầm sàn, C Cửa trời/nóc gió, D Thưng vách, E Canopy, F Vận chuyển&lắp đặt; mỗi phần có mục con I/II (trừ F gắn dòng trực tiếp).

## Mô hình dữ liệu (4 model mới — không sửa model cũ)
```
WorkPrice (catalog master)
  code @unique, name, shortName?, spec?, unit?, groupCode (AA..AL),
  material?, laborMachine?, coefficient?, baseCost?  // baseCost=(material+labor)*coeff tính khi lưu
  note?, sortOrder, createdAt, updatedAt

Quote (báo giá chi tiết)
  projectId -> Project (Cascade), title, recipient?, location?, scope?,
  quoteDate?, markup? (TL, default 1.0), clonedFromId?, note?, createdAt, updatedAt
  sections QuoteSection[]

QuoteSection (Phần A/B + Mục I/II — cây 2 cấp)
  quoteId -> Quote (Cascade), code (A/I/…), name, kind (PHAN|SUB),
  parentId? (self relation), area? (m2), sortOrder
  items QuoteItem[]

QuoteItem (dòng vật tư)
  quoteId, sectionId -> QuoteSection (Cascade), workCode? (ref WorkPrice.code),
  name, unit?, qty?, baseCost? (giá gốc snapshot, override được),
  sellPrice? (đơn giá bán = baseCost×markup, override được), spec?, note?, sortOrder
```
Project += `quotes Quote[]`.
Migration: `add_quote_pricebook`.

## File sẽ tạo / sửa
**Schema/constants/rbac**
- `prisma/schema.prisma` — 4 model + quan hệ Project.quotes; migration.
- `src/lib/constants.ts` — `WORK_GROUP` (AA..AL + nhãn), `WORK_GROUP_MAP`.
- `src/lib/rbac.ts` — resource mới `quote`: ADMIN[view,edit], SALES[view,edit], ENGINEERING[view], PROCUREMENT[view].
- `src/lib/quote.ts` (mới) — `lineCost/lineSell/computeQuoteTotals/sectionTotals`, helper baseCost.

**Catalog**
- `src/app/(app)/catalog/page.tsx` — bảng đơn giá gom nhóm AA..AL, tìm kiếm, tổng số mã.
- `src/app/(app)/catalog/CatalogEditor.tsx` — client: thêm/sửa/xóa mã (modal), tự tính giá thành.
- `src/app/(app)/catalog/actions.ts` — saveWorkPrice/deleteWorkPrice (requirePermission quote:edit).

**Báo giá theo dự án**
- `src/app/(app)/projects/[id]/quote/page.tsx` — load quotes + catalog, render QuoteEditor.
- `src/app/(app)/projects/[id]/quote/QuoteEditor.tsx` — client builder: header báo giá, hệ số TL, cây Phần→Mục→Dòng, subtotal/tổng (bán/gốc/lợi nhuận), modal item có chọn Mã CV (tự điền tên/đv/giá gốc), nút "Tạo từ dự án khác", "Cập nhật đơn giá".
- `src/app/(app)/projects/[id]/quote/actions.ts` — saveQuote/deleteQuote, saveSection/deleteSection, saveItem/deleteItem, cloneQuoteFrom(projectId, sourceQuoteId), repriceQuote(quoteId), pushSalePrice(quoteId).

**Danh sách + điều hướng**
- `src/app/(app)/quotes/page.tsx` — danh sách tất cả báo giá (dự án, tiêu đề, tổng bán/gốc/LN, ngày).
- `src/components/layout/Sidebar.tsx` — nav "Đơn giá & Báo giá" (icon Tags/Receipt), resource `quote`. (Catalog vào cùng nav hoặc nav phụ — đặt 1 mục `/quotes` + link catalog ở đầu trang quotes.)
- `src/app/(app)/projects/[id]/page.tsx` — card "Báo giá chi tiết" (tổng bán/gốc/LN) link `/projects/[id]/quote`, gate canViewQuote.

**Import**
- `scripts/import-pricebook.ts` (`npm run import:pricebook`) — đọc sheet DV → upsert 135 WorkPrice (idempotent theo code).
- `scripts/import-quote.ts` (`npm run import:quote`) — tạo/đảm bảo dự án demo (code `DEMO1`), parse BG CT → 1 Quote + sections (Phần A–F, mục I/II) + items (giữ đơn giá bán & giá gốc thật, markup=1.2). Idempotent (xóa quote demo cũ rồi tạo lại).
- `package.json` — 2 script trên.

## Kiến trúc / luồng
- **Giá gốc vs bán**: catalog giữ giá gốc (baseCost). Khi thêm dòng chọn Mã CV → copy name/unit/baseCost vào QuoteItem (snapshot). sellPrice mặc định = baseCost × quote.markup, sửa tay được.
- **Clone**: `cloneQuoteFrom` tạo Quote mới trên dự án đích, deep-copy sections+items (giữ qty + cấu trúc), với mỗi item: baseCost = catalog[workCode].baseCost (fallback baseCost nguồn), sellPrice = baseCost × markup mới. Set clonedFromId.
- **Reprice**: `repriceQuote` cập nhật baseCost từ catalog cho mọi item có workCode, sellPrice = baseCost × markup.
- **Tổng**: tính ở `lib/quote.ts` (không lưu cứng) — sellTotal = Σ qty×sellPrice, costTotal = Σ qty×baseCost, profit = sell−cost, margin = profit/sell.
- **pushSalePrice**: ghi project.salePrice = sellTotal (nút thủ công, quyền quote:edit + project:edit).

## Verification
1. `npx tsc --noEmit` EXIT 0 (chạy song song dev server an toàn).
2. Migrate: dừng dev server (khóa Prisma engine) → `prisma migrate dev --name add_quote_pricebook` → `prisma generate` → restart dev.
3. `npm run import:pricebook` → 135 mã; mở `/catalog` thấy 9 nhóm, sửa thử VT/NC/HS thấy giá thành đổi.
4. `npm run import:quote` → dự án DEMO1 có báo giá; mở `/projects/<demo>/quote` đối chiếu vài dòng (Thép tổ hợp AA.110: KL 31529.8, bán 23.782, gốc 19.818) + tổng Phần A khớp ~1,29 tỷ bán.
5. Tạo báo giá mới rỗng trên 1 dự án thật → thêm Phần/Mục/dòng (chọn Mã CV tự điền) → tổng cập nhật đúng.
6. "Tạo từ dự án khác" chọn báo giá DEMO1 → ra bản mới đủ dòng, giá kéo từ catalog; đổi TL → "Cập nhật đơn giá" thấy đơn giá bán đổi.
7. RBAC: SALES sửa được; ENGINEERING/PROCUREMENT chỉ xem (nút sửa ẩn).
8. Playwright chụp `/catalog`, `/projects/<demo>/quote`, `/quotes`.

## Ghi chú kỹ thuật
- Ô công thức ExcelJS → đọc `.result`; nếu null bỏ qua.
- Dev server khóa `query_engine` DLL → phải Stop-Process cổng 3000 trước migrate/generate.
- Không `init` accessor; Prisma Float nullable.
- clonedFromId tự tham chiếu Quote (optional, onDelete SetNull).
