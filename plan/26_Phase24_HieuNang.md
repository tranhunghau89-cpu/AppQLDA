# Phase 24 — Hiệu năng

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 24.
> Khác với các phase trước, phase này **đo trước rồi mới sửa**, và một vài hạng mục
> trong kế hoạch ban đầu bị bỏ vì số đo cho thấy chúng không đáng làm lúc này.

---

## Số đo nền

Đo từ máy ở Việt Nam tới DB Supabase ở Tokyo (`ap-northeast-1`):

```
SELECT 1                      → 325–348ms   ← đây là SÀN, thuần độ trễ mạng
project.count()               → 345ms       ← ~0ms công việc DB
project.groupBy(status)       → 326ms       ← ~1ms công việc DB
estimateItem.groupBy + sum    → 326ms       ← ~1ms công việc DB
```

**Kết luận quan trọng nhất:** ở quy mô hiện tại (123 dự án, 516 dòng dự toán) công việc
thật của DB gần như bằng 0. Toàn bộ thời gian là **độ trễ mạng × số lượt đi–về
(round-trip)**. Vậy thứ cần tối ưu là *số round-trip*, không phải tốc độ truy vấn.

Con số tuyệt đối ở đây (325ms/lượt) là của máy dev; production chạy trên Vercel Hong Kong
nên độ trễ thấp hơn nhiều. Nhưng **số round-trip là chỉ số bất biến** — giảm được ở đây
thì giảm ở đâu cũng đúng.

---

## 24.1 Index cho khóa ngoại

Migration `20260910120000_fk_indexes` — **18 index**.

PostgreSQL không tự tạo index cho khóa ngoại (khác MySQL). Trước đó `Contract`,
`ContractItem`, `PurchaseOrder`, `PurchaseOrderItem`, `PoItemImage`, `Quote`,
`QuoteSection`, `QuoteItem`, `CostCategory`, `CostItem` **chỉ có mỗi khóa chính**.

> **Nói thẳng: việc này KHÔNG làm app nhanh lên hôm nay.** Ở 516 dòng, quét toàn bảng
> mất ~1ms. Đây là bảo hiểm cho tương lai, và `EXPLAIN` xác nhận planner đã chuyển sang
> dùng index ngay:
>
> ```
> INDEX    ProjectMember theo userId   Index Scan using "ProjectMember_userId_idx"
> INDEX    EstimateItem theo projectId Bitmap Heap Scan
> INDEX    PurchaseOrderItem theo orderId  Index Scan
> ```

Riêng `ProjectMember(userId)` có giá trị ngay: nó được dùng ở **mọi request** để lọc
phạm vi dự án (cơ chế của Phase 21).

## 24.2 Gộp truy vấn trùng trong cùng một request

- `myProjectIds()` bọc `cache()` của React — hàm này chạy nhiều lần mỗi request
  (layout gọi `myProjects`, trang gọi `scopedProjectWhere`). Nay còn 1 truy vấn.
- `canAccessProject()` **không còn tự truy vấn**, mà dùng lại danh sách đã cache. Một
  server action có thể gọi nó vài lần (guard + đối chiếu thực thể) — trước đây mỗi lần
  là một truy vấn riêng.

## 24.3 Song song hóa — thay đổi lớn nhất

Toàn bộ các trang đều viết theo kiểu `await` nối tiếp nhau, dù các truy vấn độc lập.

**Guard phân quyền vẫn chạy TRƯỚC và tuần tự** — chỉ các truy vấn dữ liệu sau đó mới
được gộp song song. Không nới lỏng bảo mật của Phase 21.

| Trang | Trước | Sau | |
|---|---|---|---|
| Tổng quan | 869ms · 2,7 RT | 462ms · 1,4 RT | **47% nhanh hơn** |
| Chi tiết dự án | 2.959ms · 9,0 RT | 1.626ms · 5,0 RT | **45% nhanh hơn** |
| Đơn hàng dự án | 779ms · 2,4 RT | 455ms · 1,4 RT | **42% nhanh hơn** |
| Tiến độ tuần | 1.045ms · 3,0 RT | 348ms · 1,0 RT | **67% nhanh hơn** |

Trang dự toán và trang báo giá cũng đã gộp (3 và 4 truy vấn → 1 lượt).

### Dashboard: đã thử đưa phép cộng vào SQL, và quyết định KHÔNG làm

Đo ba cách:

```
A. hiện trạng (1 findMany + 4 include)     869ms   2,7 RT
B. Promise.all các truy vấn rời            465ms   1,4 RT
C. groupBy — cộng ngay trong DB            457ms   1,4 RT
```

B và C **ngang nhau**. Lợi ích đến từ chạy song song, không phải từ việc chuyển phép
tính sang SQL. Mà cách C bắt buộc phải chép logic của `computeAmount()` (ưu tiên
`amount`, nếu trống thì `actualQty ?? designQty × unitPrice`) sang SQL — tức là có hai
bản của cùng một quy tắc nghiệp vụ, trong đó bản SQL không được test.

Chọn B: giữ `computeProfit()` / `computeAmount()` đã có 14 test làm nguồn chân lý duy nhất.

Dashboard cũng được lọc bớt ngay ở DB: chỉ nạp mốc **chưa xong và đã quá hạn** thay vì
nạp mọi mốc rồi lọc bằng JS; số mốc đã hoàn thành lấy bằng `groupBy` đếm thay vì nạp
từng dòng.

## 24.4 `signedUrl` gọi nối tiếp trong vòng lặp

Chỗ tệ nhất tìm được, ở cả `/weekly` lẫn trang chi tiết dự án:

```ts
for (const im of noteImgs) {
  const url = await signedUrl(im.key);   // 1 lần gọi API Supabase Storage MỖI ẢNH
  ...
}
```

20 ảnh = 20 lượt gọi nối đuôi nhau. Đã chuyển sang `Promise.all`.

> **Nói thẳng: hiện chưa đo được lợi ích** vì DB đang có **0 ảnh ghi chú**. Đây là lỗi
> tiềm ẩn, và nó sẽ nổ ra đúng lúc Phase 23 vừa mở đường cho việc chụp ảnh hiện trường
> từ điện thoại.

---

## Hạng mục trong kế hoạch bị BỎ, kèm lý do

### Phân trang + tìm kiếm phía server — **không làm**

Kế hoạch đề xuất phân trang cho Dự án, Đơn hàng, Hợp đồng, Bảng đơn giá.
Số đo cho thấy đây là tối ưu sớm:

- 123 dự án, 516 dòng dự toán, 135 mã đơn giá — tải toàn bộ mất ~0ms công việc DB.
- Lọc/tìm kiếm phía client hiện **nhanh hơn** phân trang server: gõ phím không tốn
  round-trip nào, còn tìm kiếm server thì mỗi lần gõ là ~325ms.
- Phân trang kéo theo trạng thái trên URL, đồng bộ tham số, phân trang trong UI — phức
  tạp thật để đổi lấy lợi ích âm.

**Ngưỡng nên xem lại:** khi `Project` vượt ~1.000 dòng hoặc `EstimateItem` vượt ~20.000
dòng. Lúc đó payload của dashboard (hiện ~40KB) mới thành vấn đề trên mạng 3G.

### Cache dữ liệu danh mục — **đã làm rồi rút lại**

Có viết `src/lib/reference.ts` bọc `unstable_cache` cho NCC / CĐT / bảng đơn giá, kèm
`revalidateTag` ở các action ghi. Sau đó rút lại vì hai lý do:

1. Ở Next 16, `revalidateTag(tag, "max")` chỉ **đánh dấu cũ** (stale-while-revalidate) —
   thêm một NCC rồi mở form đặt hàng có thể vẫn chưa thấy. Hàm đúng ngữ nghĩa là
   `updateTag`, nhưng tài liệu chỉ nói nó nhận tag từ `cacheTag`/`fetch`, không khẳng
   định có nhận tag của `unstable_cache` hay không.
2. Không có tài khoản đăng nhập nên **không kiểm chứng được** việc xóa cache có chạy
   đúng không. Ship một lớp cache không xác minh được là rủi ro cao hơn lợi ích.

Song song hóa (24.3) đã lấy được gần hết phần lợi ích về thời gian thực, mà không có
rủi ro dữ liệu cũ. **Cache vẫn là hướng tốt cho sau này** — nhưng chỉ khi kiểm chứng
được `updateTag` trên môi trường thật, và chỉ cho dữ liệu KHÔNG theo phạm vi người dùng.

### Ghi báo giá theo lô — **đã làm ở Phase 22**

`repriceQuote` đã dùng `db.$transaction([...])`, gửi cả lô trong 1 round-trip.

---

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 vấn đề |
| `npm test` | ✅ 129/129 |
| `npm run build` | ✅ compiled successfully |
| Migration index trên DB thật | ✅ áp xong, `EXPLAIN` xác nhận planner dùng index |
| Đo trước/sau 4 trang | ✅ nhanh hơn 42–67% |

**Chưa kiểm chứng:** hành vi thực tế trên trình duyệt sau đăng nhập (cần tài khoản).
Các thay đổi đều là gộp truy vấn, không đổi dữ liệu trả về, nhưng vẫn nên xem lại
trang Tổng quan và Chi tiết dự án một lượt.

## Việc còn lại

- Đo lại trên production sau khi deploy (độ trễ Vercel HK → Supabase Tokyo thấp hơn
  nhiều, tỷ lệ cải thiện có thể khác).
- Trang chi tiết dự án vẫn còn **5 round-trip**: truy vấn `project` ở đó có 8 quan hệ
  `include`, Prisma tách thành nhiều truy vấn. Muốn giảm nữa phải tách nhỏ trang (ví dụ
  tải phần hợp đồng / đơn hàng / báo giá theo tab hoặc bằng Suspense).
- Xem lại phân trang khi dữ liệu chạm ngưỡng nêu trên.
