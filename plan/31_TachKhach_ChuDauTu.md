# Tách "Khách đang chào giá" khỏi "Chủ đầu tư" — kế hoạch

## Vấn đề

Muốn lập một bản báo giá, hiện nay bắt buộc phải đi qua ba bước:

1. Tạo `Customer` — nhưng cả giao diện lẫn menu đều gọi nó là **"Chủ đầu tư"**
2. Tạo `Project` — bắt buộc có **`code` duy nhất** (`schema.prisma`: `code String @unique`;
   `projects/actions.ts:69` bắt `min(1)`)
3. Rồi mới lập được báo giá — `ClientQuote.projectId` là cột **bắt buộc**

Hậu quả đúng như mô tả: một người mới hỏi giá đã lập tức chiếm một **mã dự án** và nằm trong
danh sách **Chủ đầu tư**, dù chưa ký gì. Chào giá mười nơi, trúng một, thì chín mã dự án chết
và chín cái tên nằm nhầm chỗ. Mã dự án `@unique` nên xóa đi mới dùng lại được.

## Nhận định then chốt

> "Khách" và "CĐT" **không phải hai loại công ty**. Đó là **hai giai đoạn của một thương vụ**.

Cùng một pháp nhân có thể đang là CĐT của dự án N037 (đã ký) **và đồng thời** là khách của một
lần chào giá mới. Nên:

- **Không** tách `Customer` thành hai bảng — cùng một công ty sẽ bị nhập hai lần, công nợ và
  lịch sử liên hệ vỡ làm đôi.
- **Không** thêm cột `stage` vào `Customer` — một công ty không thể vừa `KHACH` vừa `CDT`.
- Thứ đang thiếu là **bản thân thương vụ**: một thực thể đứng TRƯỚC dự án, giữ toàn bộ phần
  CRM, và không cần mã dự án.

## Mô hình đề xuất

```
Customer  (pháp nhân — giữ nguyên bảng, giữ nguyên dữ liệu)
   │
   ├── CoHoi[]      cơ hội chào giá   ← phần "Khách": CRM, KHÔNG cần mã dự án
   │      └── ClientQuote[]
   │
   └── Project[]    dự án             ← phần "CĐT": mã dự án, dự toán, hợp đồng
          └── ClientQuote[]              (báo giá chuyển sang khi chốt)
```

Nhãn **CĐT / Khách** ở trang Chủ đầu tư **suy ra, không lưu**:

| Công ty có | Hiện nhãn |
|---|---|
| ≥ 1 dự án | **CĐT** |
| chỉ có cơ hội đang mở | **Khách** |
| cả hai | **cả hai** — đúng thực tế, không phải lỗi |

### Model mới `CoHoi`

```prisma
// Một lần chào giá, tồn tại TRƯỚC khi có dự án. Đây là nơi phần CRM sống: khách là
// ai, công trình gì, ai đang theo, đã trao đổi những gì.
//
// Cố ý KHÔNG có mã duy nhất kiểu Project.code: chào giá mười nơi trúng một thì chín
// mã kia là rác. Mã dự án chỉ sinh lúc chốt.
model CoHoi {
  id         String    @id @default(cuid())
  customerId String?   // để trống được: khách gọi tới hỏi giá, chưa kịp khai pháp nhân
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)

  tenCongTrinh   String   // "Nhà xưởng Hồng Ngự" — chưa phải tên dự án chính thức
  diaDiem        String?
  buildingType   String?  // khớp Project.buildingType -> chọn sẵn mẫu báo giá
  dienTichDuKien Float?
  nguon          String?  // giới thiệu / website / gọi đến / khác

  // Phân quyền của cơ hội KHÔNG đi qua ProjectMember (chưa có dự án) mà theo người
  // phụ trách. Xem phần "Phân quyền" trong plan.
  ownerId   String?
  ownerName String?  // chụp lại lúc tạo, sống sót khi xóa tài khoản

  trangThai String  @default("MOI") // MOI|DANG_CHAO|DAM_PHAN|CHOT|MAT
  lyDoMat   String?

  // Điền khi đã chuyển thành dự án — cũng là dấu "cơ hội này đã chốt".
  projectId String?  @unique
  project   Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  clientQuotes ClientQuote[]
  contacts     CustomerNote[]

  @@index([customerId])
  @@index([trangThai])
  @@index([ownerId])
}
```

### `ClientQuote` sống được ở cả hai nơi

```prisma
projectId String?   // was: String  (bắt buộc)
coHoiId   String?
```

Bất biến: **đúng một trong hai có giá trị**. Không ép bằng CHECK constraint (Prisma không
sinh ra được, và migration thêm CHECK trên bảng đang có dữ liệu là rủi ro) mà ép ở tầng
action + một test chuyên cho việc đó.

---

## Phần rủi ro nhất: phân quyền

Đây là chỗ dễ hỏng nhất của cả kế hoạch, phải làm trước và làm kỹ.

Hiện **toàn bộ** quyền của báo giá gửi khách đi qua dự án:

| Chỗ | Cách scope hiện tại |
|---|---|
| `client-quote/actions.ts` | `denyProject("quote","edit",projectId,…)` — 59 chỗ dùng `projectId` |
| `client-quote/page.tsx` | `requireProjectView("quote", id)` |
| `/client-quotes` | `scopedByProjectWhere(session)` |
| Trang in | đường dẫn `/projects/[id]/client-quote/[quoteId]/print` |
| `revalidatePath` | `/projects/${projectId}/client-quote` |

Cơ hội không có dự án, nên `canAccessProject` không dùng được. Quy tắc thay thế:

> **ADMIN thấy tất cả cơ hội. Vai trò khác chỉ thấy cơ hội mình phụ trách (`ownerId`).**

Cần thêm, đối xứng với `denyProject`:

```ts
// src/lib/scope.ts
canAccessCoHoi(session, coHoiId): Promise<boolean>
// src/lib/auth.ts
denyCoHoi(resource, action, coHoiId, fallback)
requireCoHoiView(resource, coHoiId)
```

Và `/client-quotes` chuyển từ một điều kiện thành **OR hai nguồn**:

```ts
where: { OR: [ { projectId: { in: duAnTrongPhamVi } },
               { coHoi: { ownerId: session.userId } } ] }
```

**Bẫy:** `scopedByProjectWhere` trả `{}` cho ADMIN. Nếu vô ý giữ nguyên rồi `OR` thêm điều
kiện cơ hội, mệnh đề `{}` sẽ khớp **mọi** dòng và bất kỳ ai cũng thấy tất cả. Phải viết lại
hàm này cho ClientQuote thay vì tái dùng, và có test cho đúng trường hợp "user thường, không
được gán dự án nào, không phụ trách cơ hội nào → thấy 0 dòng".

---

## Chuyển cơ hội thành dự án

Một nút trên cơ hội: **"Chốt — tạo dự án"**. Trong MỘT `$transaction`:

1. Tạo `Project` — **lúc này** mới nhập mã dự án, và mới kiểm trùng
2. `Project.customerId = coHoi.customerId` (thiếu CĐT thì bắt khai trước, không cho chốt)
3. Chuyển mọi `ClientQuote` của cơ hội: `projectId = <mới>`, `coHoiId = null`
4. `coHoi.projectId = <mới>`, `trangThai = "CHOT"`
5. Gán người phụ trách vào `ProjectMember` — nếu không, chính người vừa chốt lại mất
   quyền xem báo giá của mình
6. `recordAudit` trên cả hai thực thể

Chiều ngược lại — mất khách: `trangThai = "MAT"` + `lyDoMat`. Không tạo dự án, không tốn mã,
lịch sử trao đổi giữ nguyên để lần sau còn tra.

---

## Dữ liệu đang có

**Không tự động chuyển gì cả.** Không thể biết bằng máy dự án nào thực ra là cơ hội: trạng
thái `CHO` có thể là đã ký nhưng chưa khởi công. Đoán sai là xóa mã dự án của một hợp đồng
thật.

Mọi thứ đang có giữ nguyên là dự án. Cơ hội chỉ dùng cho việc mới. Nếu muốn dọn, làm tay —
và chỉ khi người dùng chỉ đích danh từng dự án.

Migration `32_co_hoi`: thêm bảng `CoHoi`, thêm `ClientQuote.coHoiId`, và nới
`ClientQuote.projectId` thành nullable. Nới NOT NULL là thao tác **thêm quyền**, không mất dữ
liệu, chạy được trên DB đang phục vụ.

---

## Chia giai đoạn

| # | Việc | Ghi chú |
|---|---|---|
| **8.1** | Model `CoHoi` + migration + `canAccessCoHoi`/`denyCoHoi` + test phân quyền | Làm trước tất cả |
| **8.2** | `ClientQuote.projectId` nullable + `coHoiId`; sửa 59 chỗ trong actions | Rủi ro cao nhất |
| **8.3** | Route `/co-hoi` — danh sách + trang chi tiết, kèm báo giá và nhật ký trao đổi | |
| **8.4** | Nút "Chốt — tạo dự án" + "Mất khách" | |
| **8.5** | Nhãn CĐT/Khách suy ra ở `/customers`; đổi chữ trong giao diện | |
| **8.6** | Gộp hai nguồn vào `/client-quotes` và bản tin nhắc việc | |

Thứ tự cứng: 8.1 → 8.2 → còn lại. Làm 8.3 trước 8.1 là dựng giao diện trên một mô hình quyền
chưa có.

---

## Những gì CỐ Ý không làm

- **Không tách `Customer` thành hai bảng.** Cùng một công ty sẽ bị nhập hai lần; công nợ,
  lịch sử liên hệ và báo giá vỡ làm đôi.
- **Không thêm `stage` vào `Customer`.** Một công ty vừa là CĐT dự án cũ vừa là khách của
  lần chào giá mới — một cột không diễn tả được.
- **Không cho dự toán / báo giá chi tiết ở giai đoạn cơ hội** (xem câu hỏi 1). Cơ hội báo giá
  bằng đơn giá của mẫu hoặc nhập tay; bóc tách đầy đủ để sau khi chốt.
- **Không sinh mã cơ hội tự động.** Cần bộ đếm theo năm và chiến lược khóa, mà cơ hội thì
  nhận diện bằng tên công trình + tên khách là đủ.
- **Không đổi `Contract`.** Hợp đồng vẫn gắn dự án; cơ hội chốt rồi mới có hợp đồng.

---

## Câu hỏi cần chốt trước khi làm

1. **Ở giai đoạn cơ hội có cần dự toán không?**
   Hiện dự toán và báo giá chi tiết đều gắn `Project`. Nếu cơ hội chỉ cần báo giá theo đơn
   giá mẫu / nhập tay thì kế hoạch trên đủ. Nếu cần bóc tách sơ bộ ngay từ lúc chào giá thì
   phải nới cả `Quote` và `EstimateItem` — gấp đôi khối lượng việc.
   *Khuyến nghị: chưa cần. Chào giá nhanh dựa trên đơn giá m² là đúng thực tế.*

2. **Một cơ hội có thể có nhiều công trình không?**
   Ví dụ khách hỏi giá 2 nhà xưởng cùng lúc — một cơ hội hai công trình, hay hai cơ hội?
   *Khuyến nghị: hai cơ hội. Đơn giản hơn và mỗi cái chốt/mất độc lập.*

3. **Dữ liệu đang có: giữ nguyên hay dọn?**
   *Khuyến nghị: giữ nguyên. Nếu muốn dọn, chỉ chuyển những dự án anh chỉ đích danh.*
