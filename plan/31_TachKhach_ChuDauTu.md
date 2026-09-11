# Tách CRM (khách đang chào giá) khỏi quản lý dự án (CĐT) — kế hoạch

> Bản v2, sau khi chốt hướng. Thay đổi lớn so với v1: **dự toán chi tiết phải có ngay ở giai
> đoạn chào giá**, và **CRM tách hẳn thành khu riêng với bảng khách hàng riêng**.

## Vấn đề

Muốn lập một bản báo giá, hiện nay bắt buộc đi qua ba bước:

1. Tạo `Customer` — mà giao diện gọi thẳng là **"Chủ đầu tư"**
2. Tạo `Project` — bắt buộc có **`code` duy nhất** (`schema.prisma`; `projects/actions.ts:69`)
3. Rồi mới báo giá được — `ClientQuote.projectId` và `Quote.projectId` đều **bắt buộc**

Chào giá mười nơi trúng một thì chín mã dự án chết (mã `@unique`, xóa đi mới dùng lại) và chín
cái tên nằm nhầm trong danh sách CĐT.

## Hướng đã chốt

- **CRM là một khu riêng.** Nhân viên kinh doanh vào đó tạo khách mới, ghi trao đổi, lập báo
  giá — không cần dự án, không cần mã dự án.
- **Khách ≠ CĐT, và là hai bảng khác nhau.** Khách là người đang trao đổi; CĐT là pháp nhân đã
  ký hợp đồng.
- **Báo giá m² căn cứ từ dự toán chi tiết**, nên dự toán chi tiết phải làm được ngay ở giai
  đoạn chào giá. Dự toán đó lấy từ thư viện: mẫu dự toán sẵn có, hoặc clone từ báo giá của một
  công trình tương tự đã làm.
- **Chỉ khi ký hợp đồng** mới chuyển khách sang bên quản lý dự án — và lúc đó được chọn: tạo
  CĐT mới, **hoặc áp vào một CĐT đã có**.

### Vì sao lần này tách bảng, dù v1 khuyên ngược lại

v1 phản đối tách `Customer` làm hai, sợ cùng một công ty bị nhập hai lần rồi công nợ và lịch
sử vỡ đôi. Yêu cầu **"áp vào CĐT hiện đã có"** chính là thứ vô hiệu hóa nỗi lo đó: lúc chuyển
sang, hai bản ghi được nối bằng một khóa (`KhachHang.customerId`), nên không có hai bản song
song mà không biết nhau.

Và tách bảng hợp với thực tế bán hàng: lúc mới gọi điện chỉ biết *một người ở một công ty*, còn
MST, địa chỉ pháp lý, người đại diện — những thứ `Customer` cần để lên hợp đồng — thì mãi sau
mới có. Ép người tư vấn khai đủ ngay từ cuộc gọi đầu là ép sai chỗ.

## Mô hình

```
CRM (khu riêng)                              Quản lý dự án
──────────────────────────────────           ──────────────────────────────
KhachHang ─┬─ TraoDoi[]         nhật ký
           │
           └─ CoHoi[]           một công trình đang chào giá
                 ├─ Quote        dự toán / báo giá chi tiết  ┐
                 └─ ClientQuote  báo giá m² gửi khách        ┘
                        │
                   ký hợp đồng
                        ↓
                   Customer (CĐT)  ── Project ── Contract
                   tạo mới HOẶC áp vào cái đã có
```

### `KhachHang` — bảng CRM

```prisma
// Khách đang trao đổi. KHÁC Customer (chủ đầu tư): Customer là pháp nhân đã ký hợp
// đồng, cần MST/địa chỉ/người đại diện. Ở đây chỉ cần đủ để gọi lại được.
model KhachHang {
  id       String  @id @default(cuid())
  tenCty   String  // "Công ty CP ABC" hoặc chỉ tên người, tùy lúc gọi biết tới đâu
  nguoiLienHe String?
  phone    String?
  email    String?
  diaChi   String?
  nguon    String? // giới thiệu / website / gọi đến / triển lãm / khác

  // Phân quyền của CRM đi theo NGƯỜI PHỤ TRÁCH, không qua ProjectMember (chưa có dự án).
  ownerId   String?
  ownerName String? // chụp lại lúc tạo, sống sót khi xóa tài khoản

  // Điền khi đã ký hợp đồng và chuyển sang bên quản lý dự án. Trỏ tới CĐT mới tạo
  // HOẶC một CĐT đã có sẵn — đây là chỗ chống nhập trùng công ty.
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coHoi    CoHoi[]
  traoDoi  CustomerNote[]

  @@index([ownerId])
  @@index([customerId])
}
```

### `CoHoi` — một công trình đang chào giá

Cần thực thể này chứ không treo báo giá thẳng vào khách, vì `generateFromQuote` đang đọc
`project.area` làm mẫu số dự phòng và `project.buildingType` để chọn sẵn mẫu báo giá. Không có
chỗ giữ hai thứ đó thì suy đơn giá m² gãy.

```prisma
// Một công trình đang chào giá. Đứng TRƯỚC dự án, nên KHÔNG có mã duy nhất kiểu
// Project.code: chào mười nơi trúng một thì chín mã kia là rác.
model CoHoi {
  id          String    @id @default(cuid())
  khachHangId String
  khachHang   KhachHang @relation(fields: [khachHangId], references: [id], onDelete: Cascade)

  tenCongTrinh   String  // "Nhà xưởng Hồng Ngự" — chưa phải tên dự án chính thức
  diaDiem        String?
  buildingType   String? // khớp Project.buildingType -> chọn sẵn mẫu báo giá
  dienTich       Float?  // m2 — mẫu số khi suy đơn giá m²
  kK Float?  kL Float?  kH Float?

  trangThai String  @default("MOI") // MOI|DANG_CHAO|DAM_PHAN|KY_HD|MAT
  lyDoMat   String?

  // Điền khi đã ký hợp đồng. Cũng là dấu "cơ hội này đã xong".
  projectId String?  @unique
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  quotes       Quote[]
  clientQuotes ClientQuote[]

  @@index([khachHangId])
  @@index([trangThai])
}
```

### Hai bảng báo giá sống được ở cả hai nơi

```prisma
// Quote  (dự toán / báo giá chi tiết)
projectId String?   // was: String
coHoiId   String?

// ClientQuote  (báo giá m² gửi khách)
projectId String?   // was: String
coHoiId   String?
```

Bất biến: **đúng một trong hai có giá trị**. Không ép bằng CHECK constraint (Prisma không sinh
được, và thêm CHECK lên bảng đang có dữ liệu là rủi ro) mà ép ở tầng action, kèm test riêng.

### Nhật ký trao đổi chuyển về khách

`CustomerNote` hiện gắn `Customer`. Chuyển sang gắn `KhachHang`:

```prisma
customerId  String?   // was: String  — giữ lại cho ghi chép sau khi đã thành CĐT
khachHangId String?
```

Phần CRM vừa ship ở Phase 6 nên dữ liệu thật gần như chưa có; backfill rẻ.

---

## Dự toán ở giai đoạn chào giá

Đây là phần v1 đánh giá sai, và là phần nặng nhất của kế hoạch.

Nguồn dự toán mà bên mình đã có sẵn, **không phải xây mới**:

| Nguồn | Đã có | Dùng thế nào |
|---|---|---|
| Mẫu dự toán theo hạng mục | `EstimateTemplate` + `/estimate-templates` | "Thêm hạng mục từ mẫu" |
| Báo giá công trình tương tự đã làm | `cloneQuoteFrom` (`quote/actions.ts:300`) | Clone nguyên bảng giá của một dự án cũ |
| Mẫu báo giá theo loại công trình | `QuoteTemplate` (Phase 5) | Chọn mẫu khi sinh bản m² |

Việc phải làm chỉ là cho ba đường này chạy được khi đích đến là **cơ hội** thay vì dự án.
Riêng `cloneQuoteFrom` thì **nguồn vẫn là dự án cũ** — không đổi; chỉ đích đến đổi.

**Chi phí thật:** `Quote` bị đóng đinh vào `Project` y hệt `ClientQuote`. Phải làm lại cùng
một việc cho cả hai bảng. Đó là lý do kế hoạch này dài gấp đôi v1.

---

## Phần rủi ro nhất: phân quyền

Toàn bộ quyền của cả hai loại báo giá hiện đi qua dự án:

| Chỗ | Cách scope hiện tại |
|---|---|
| `client-quote/actions.ts` | `denyProject("quote","edit",projectId,…)` — 59 chỗ dùng `projectId` |
| `quote/actions.ts` | cùng kiểu, 455 dòng |
| `client-quote/page.tsx`, `quote/page.tsx` | `requireProjectView("quote", id)` |
| `/client-quotes`, `/quotes` | `scopedByProjectWhere(session)` |
| Trang in | đường dẫn `/projects/[id]/...` |
| `revalidatePath` | `/projects/${projectId}/...` |

Cơ hội không có dự án nên `canAccessProject` vô dụng. Quy tắc thay thế:

> **ADMIN thấy tất cả. Vai trò khác chỉ thấy khách mình phụ trách (`KhachHang.ownerId`),
> và mọi cơ hội / báo giá thuộc khách đó.**

Thêm, đối xứng với `denyProject`:

```ts
// src/lib/scope.ts
canAccessCoHoi(session, coHoiId): Promise<boolean>   // truy qua KhachHang.ownerId
// src/lib/auth.ts
denyCoHoi(resource, action, coHoiId, fallback)
requireCoHoiView(resource, coHoiId)
```

Và danh sách gộp hai nguồn:

```ts
where: { OR: [ { projectId: { in: duAnTrongPhamVi } },
               { coHoi: { khachHang: { ownerId: session.userId } } } ] }
```

**Bẫy phải nhớ:** `scopedByProjectWhere` trả `{}` cho ADMIN. Giữ nguyên rồi `OR` thêm điều
kiện cơ hội thì mệnh đề `{}` khớp **mọi** dòng, và ai cũng thấy báo giá của tất cả. Phải viết
hàm riêng cho hai bảng báo giá, kèm test đúng ca *"user thường, không được gán dự án nào,
không phụ trách khách nào → thấy 0 dòng"*.

---

## Chuyển sang bên quản lý dự án

Điều kiện: cơ hội có một `ClientQuote` ở trạng thái **Đã chốt**, và **đã ký hợp đồng**.

Nút **"Đã ký hợp đồng — chuyển sang dự án"**. Hộp thoại hỏi hai việc:

**1. Chủ đầu tư** — hai lựa chọn, mặc định là (a):

- (a) **Tạo CĐT mới** từ thông tin khách, cho sửa lại trước khi tạo (thêm MST, địa chỉ pháp
  lý, người đại diện — những thứ hợp đồng cần mà CRM chưa có)
- (b) **Áp vào CĐT đã có** — chọn từ danh sách. Dùng khi khách này thực ra là một công ty
  mình đã làm rồi. Gợi ý sẵn CĐT có tên gần giống (dùng `norm()` ở `lib/text.ts`).

**2. Mã dự án** — nhập lúc này, và chỉ kiểm trùng lúc này.

Rồi trong MỘT `$transaction`:

1. Tạo hoặc lấy `Customer`; `KhachHang.customerId = <id>`
2. Tạo `Project` với mã vừa nhập, `customerId`, và chép `tenCongTrinh / diaDiem /
   buildingType / dienTich / kK / kL / kH` từ cơ hội
3. Chuyển mọi `Quote` và `ClientQuote` của cơ hội: `projectId = <mới>`, `coHoiId = null`
4. `CoHoi.projectId = <mới>`, `trangThai = "KY_HD"`
5. **Gán người phụ trách vào `ProjectMember`** — quên bước này thì chính người vừa chốt mất
   quyền xem báo giá của mình ngay sau khi chuyển
6. `recordAudit` trên `KhachHang`, `CoHoi`, `Project`

Chiều ngược lại — mất khách: `trangThai = "MAT"` + `lyDoMat`. Không tạo dự án, không tốn mã,
lịch sử trao đổi giữ nguyên để lần sau còn tra.

---

## Dữ liệu đang có

**Không tự động chuyển gì cả.** Máy không phân biệt được dự án trạng thái `CHO` là cơ hội hay
hợp đồng đã ký chưa khởi công. Đoán sai là xóa mã của một hợp đồng thật.

Mọi thứ đang có giữ nguyên là dự án; CRM chỉ dùng cho việc mới. Muốn dọn thì làm tay, và chỉ
với những dự án được chỉ đích danh.

Nới `NOT NULL` trên `Quote.projectId` / `ClientQuote.projectId` là thao tác **thêm quyền**,
không mất dữ liệu, chạy được trên cơ sở dữ liệu đang phục vụ.

---

## Chia giai đoạn

Kế hoạch này lớn. Thứ tự dưới đây cho phép **dừng lại sau bất kỳ giai đoạn nào** mà hệ thống
vẫn chạy được.

| # | Việc | Dừng ở đây được không |
|---|---|---|
| **8.1** | `KhachHang` + `TraoDoi` + khu `/khach-hang` (CRM đứng một mình, chưa đụng báo giá) | ✅ CRM dùng được ngay, báo giá vẫn như cũ |
| **8.2** | `CoHoi` + `canAccessCoHoi` / `denyCoHoi` + test phân quyền | ✅ chưa lộ ra giao diện |
| **8.3** | `Quote` (dự toán chi tiết) sống được ở cơ hội — nullable `projectId`, mẫu + clone | ✅ |
| **8.4** | `ClientQuote` sống được ở cơ hội; trang in không còn nằm dưới `/projects` | ✅ báo giá đủ vòng đời trong CRM |
| **8.5** | "Đã ký hợp đồng — chuyển sang dự án", kèm áp vào CĐT có sẵn | ✅ khép vòng |
| **8.6** | Gộp `/quotes`, `/client-quotes`, nhắc việc; nhãn Khách/CĐT ở `/customers` | dọn nốt |

Thứ tự cứng: 8.1 → 8.2 → 8.3 → 8.4 → 8.5. Dựng giao diện trước khi có mô hình quyền là dựng
trên cát.

---

## Những gì CỐ Ý không làm

- **Không sinh mã cơ hội tự động.** Cần bộ đếm theo năm và chiến lược khóa; nhận diện bằng tên
  công trình + tên khách là đủ.
- **Không đổi `Contract`.** Hợp đồng vẫn gắn dự án — ký xong mới có dự án, nên không có vòng lặp.
- **Không cho một cơ hội chứa nhiều công trình.** Khách hỏi giá hai nhà xưởng thì tạo hai cơ
  hội: mỗi cái chốt hoặc mất độc lập, và mỗi cái ra một dự án riêng.
- **Không gộp `EstimateItem` (dự toán chi phí) vào giai đoạn chào giá.** Thứ sinh ra đơn giá
  m² là `Quote` (báo giá chi tiết), không phải `EstimateItem`. Dự toán chi phí nội bộ để sau
  khi có dự án.
- **Không tự động nối khách với CĐT trùng tên.** Chỉ *gợi ý* lúc chuyển; nối hay không là
  người quyết định.
