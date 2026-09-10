# Phase 25 — Truy vết & nhắc việc

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 25.
> Trạng thái: code hoàn tất, migration đã áp lên DB thật, chưa push.

Vấn đề gốc (mục A1.6 của bản rà soát): app cho phép sửa giá bán dự án, giá trị hợp
đồng, đợt thanh toán, đơn giá báo giá — nhưng **không có model nào ghi lại ai đổi gì
lúc nào**. Khi số liệu lệch, không có cách truy nguyên. Ngoại lệ duy nhất trước đây là
`Proposal.decidedBy`.

---

## 25.1 Model `AuditLog`

Migration `20260910150000_audit_log`.

```prisma
model AuditLog {
  actorId / actorName / actorRole   // chụp lại tại thời điểm ghi
  entity / entityId / entityLabel   // Project | Contract | ContractItem | Payment | Quote | WorkPrice
  projectId                          // để lọc theo dự án
  action                             // CREATE | UPDATE | DELETE
  changes  Json?                     // CHỈ trường thực sự đổi
  createdAt
}
```

Ba quyết định thiết kế đáng nói:

1. **Không có khóa ngoại cứng** tới `Project` / `User`. Nhật ký phải sống sót cả khi
   dự án hoặc tài khoản bị xóa — nếu cascade xóa theo thì mất đúng cái cần truy vết.
   Vì vậy `actorName`/`actorRole`/`entityLabel` được chụp lại ngay lúc ghi, đọc log
   không cần join.
2. **Chỉ lưu phần đã đổi**, không lưu ảnh chụp toàn bản ghi. Gọn hơn, và đọc ra là
   thấy ngay `salePrice: 1.000.000 → 1.200.000` thay vì phải tự so hai khối JSON.
3. **Bấm Lưu mà không đổi gì thì không ghi.** `recordAudit` bỏ qua khi `action` là
   `UPDATE` và không có trường nào khác biệt.

4 index: theo thời gian, theo dự án, theo thực thể, theo người thực hiện.

## 25.2 `src/lib/audit.ts`

- `diffFields(truoc, sau, fields)` — hàm **thuần**, trả `null` nếu không có gì đổi.
  Xử lý cẩn thận vài trường hợp dễ sai: `null` và `undefined` coi như cùng nghĩa
  "chưa có"; `0` **khác** `null` (không nhầm số 0 thành trống); `Date` so được với
  chuỗi ISO cùng thời điểm; `Date` lưu ra ISO để JSON chứa được.
- `recordAudit(...)` — **không bao giờ ném lỗi**. Ghi log hỏng thì chỉ `console.error`
  rồi đi tiếp. Thà mất một dòng nhật ký còn hơn chặn người dùng lưu hợp đồng.
- `FIELD_LABEL` — nhãn tiếng Việt cho tên trường khi hiển thị.

**14 test** cho `diffFields` và bộ nhãn.

## 25.3 Đấu nối — 16 điểm ghi

| File | Số điểm | Thao tác |
|---|---:|---|
| `projects/actions.ts` | 7 | tạo/sửa/xóa dự án, đổi trạng thái, thêm/ghi nhận/xóa đợt thanh toán |
| `projects/[id]/contract/actions.ts` | 4 | tạo/sửa/xóa hợp đồng và hạng mục |
| `projects/[id]/quote/actions.ts` | 3 | tạo/sửa/xóa báo giá, **và `pushSalePrice`** |
| `catalog/actions.ts` | 2 | tạo/sửa/xóa mã đơn giá |

`pushSalePrice` được ghi nhật ký dưới dạng thay đổi **Project.salePrice** chứ không phải
Quote — vì đó chính là thao tác ghi thẳng vào giá bán dự án, đúng thứ cần vết nhất.

`CostSummary` (quyết toán) **không có điểm ghi** vì hiện chỉ nhập bằng script CLI, UI
chỉ đọc. Khi nào làm mục "nhập Excel qua web" (Phase 26) thì phải bổ sung.

## 25.4 Giao diện

- **Tài nguyên `audit` trong RBAC — chỉ ADMIN** (`view`). Sidebar thêm mục
  "Nhật ký thay đổi".
- **`/audit`** — lọc theo thực thể / thao tác / người thực hiện bằng link (không cần
  JavaScript phía client), phân trang 50 dòng/trang.

  > Phase 24 đã kết luận *không* phân trang cho danh sách dự án vì dữ liệu nhỏ. Ở đây
  > thì ngược lại: `AuditLog` là bảng **chỉ tăng**, không bao giờ nhỏ lại. Phân trang
  > là đúng chỗ.

- **Thẻ "Lịch sử thay đổi"** trên trang chi tiết dự án, 30 dòng gần nhất. Truy vấn nằm
  trong đúng lượt `Promise.all` đã có từ Phase 24 nên **không tốn thêm round-trip**.

### Một lỗ hổng phát hiện khi đang làm

Ban đầu tôi hiển thị thẻ Lịch sử cho mọi người xem được dự án. Nhưng nhật ký chứa cả
thay đổi **giá bán, giá trị hợp đồng, số tiền thanh toán** — đúng những thứ RBAC che
khỏi vai trò Kỹ thuật và Vật tư. Hiện nó ra là lách chính cơ chế phân quyền của Phase 21.

Đã sửa: thẻ này (và cả truy vấn) chỉ chạy khi `can(role, "profit", "view")`.

| Vai trò | Xem lịch sử dự án |
|---|---|
| ADMIN · Kinh doanh · Kế toán | có |
| Kỹ thuật · Vật tư | không |

## 25.5 Nhắc việc hằng ngày

- **`src/lib/reminders.ts`** — `buildReminderReport()` và `formatReminderText()` đều là
  hàm thuần, **13 test**. Gom: mốc chưa xong đã quá ngày kế hoạch; đợt thanh toán quá
  hạn; đợt sắp tới hạn trong 7 ngày; tổng phải thu / phải trả quá hạn.
- **`/api/cron/reminders`** — Vercel Cron gọi lúc **01:00 UTC = 08:00 giờ VN** hằng
  ngày (`vercel.json`).
- Dự án đã `HOAN_THANH` bị loại khỏi phần mốc trễ — nhắc mốc của dự án đã xong là nhiễu.

### Bảo mật của endpoint

Cron không có cookie nên phải cho `/api/cron/` qua middleware. Bù lại route tự bảo vệ:

- Chưa đặt `CRON_SECRET` → **từ chối mọi request**. Thà không chạy còn hơn để endpoint
  mở toang.
- Sai secret → 401.

Đã kiểm chứng thật trên dev server: không header → 401, secret sai → 401, secret đúng → 200.

### Gửi đi đâu

**Mặc định KHÔNG gửi đi đâu cả** — chỉ ghi bản tin ra log. Việc đẩy dữ liệu công ty ra
dịch vụ bên ngoài phải là quyết định có chủ đích, nên nó nằm sau một biến môi trường:

```
REMINDER_WEBHOOK_URL=""   # để trống = chỉ ghi log
```

Khi đặt, route POST `{"text": "...", "content": "..."}` tới URL đó — hợp với Slack,
Google Chat, Discord, hoặc một endpoint trung gian tự viết để đẩy sang Zalo OA / email.
Không nhúng SDK của nhà cung cấp nào.

---

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 vấn đề |
| `npm test` | ✅ **156/156** (thêm 27 test mới) |
| `npm run build` | ✅ có `/audit` và `/api/cron/reminders` |
| Migration `AuditLog` trên DB thật | ✅ đã áp, 4 index |
| Ghi → đọc lại → xóa một dòng nhật ký | ✅ `changes` (JSONB) đọc ra đúng object |
| Xác thực endpoint cron | ✅ 401 / 401 / 200 |
| Ánh xạ truy vấn → bản tin | ✅ chạy trên dữ liệu thật, nhãn mốc và số tiền đúng |

**Điều chưa kiểm chứng được:** hiện DB **không có mốc trễ hạn nào và không có đợt thanh
toán nào chưa trả** (cả 5 mốc đều đã xong, cả 5 đợt đều đã thanh toán), nên bản tin thật
trả về toàn số 0. Tôi đã kiểm tra riêng phần truy vấn bằng cách lấy dữ liệu thật rồi giả
lập quá hạn **trong bộ nhớ** (không ghi DB) — bản tin sinh ra đúng:

```
MỐC TRỄ HẠN (3)
  · N037 K25L60_PT — Mua hàng: trễ 4 ngày
THANH TOÁN QUÁ HẠN (3)
  Phải thu quá hạn: 709.112.880 ₫
  · N051 — Thu "Đợt 1 — Tạm ứng 30% sau ký" (Cty Sơn Việt): 337.672.800 ₫, quá hạn 1 ngày
```

Cũng chưa xem giao diện `/audit` và thẻ Lịch sử trên trình duyệt (cần đăng nhập).

## Việc còn lại

1. **Đặt `CRON_SECRET` trên Vercel** — nếu không, cron chạy mỗi sáng và nhận 401,
   im lặng không làm gì. Sinh mới:
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
2. **Tùy chọn: đặt `REMINDER_WEBHOOK_URL`** nếu muốn bản tin gửi tới Zalo/Slack/email.
   Chưa đặt thì vào Vercel → Logs để đọc.
3. Gói Vercel Hobby giới hạn cron **1 lần/ngày** — lịch hiện tại đã đúng mức đó.
4. Bổ sung điểm ghi nhật ký cho `CostSummary` khi làm mục nhập Excel qua web.
