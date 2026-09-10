# Phase 26 — Nhập Excel qua web

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 26.
> Trạng thái: nhập Excel (3 bộ) và xuất PDF đã xong.

Vấn đề gốc: 9 script nhập Excel (2.088 dòng) chỉ chạy được **bằng dòng lệnh trên máy
người phát triển**. Người dùng thật không tự nhập được file nào, và bản thân script
thì ghi thẳng vào DB — sai rồi mới biết.

---

## 26.0 Khung chung

Luồng ba bước: **tải lên → xem trước → xác nhận**.

Điểm mấu chốt là tách `parse` (chỉ ĐỌC file, không chạm DB) khỏi `apply` (ghi DB).
Người dùng nhìn thấy hệ thống hiểu file thế nào — khớp vào dự án nào, bao nhiêu dòng,
tổng tiền bao nhiêu, có cảnh báo gì — rồi mới quyết định ghi.

Mỗi bộ nhập gồm hai file:

| File | Vai trò | `server-only`? | Test được? |
|---|---|---|---|
| `*-parse.ts` | bóc tách **thuần**, nhận `SheetLike` | không | có |
| `*.ts` | đọc file, khớp DB, zod, `$transaction`, ghi nhật ký | có | không |

Việc `*-parse.ts` **không** khai báo `server-only` là cố ý: nhờ vậy nó chạy được cả
trong Vitest lẫn script `tsx` kiểm chứng ngoài Next.

Ba lớp dùng chung, đều có test:

- **`lib/text.ts`** — `norm()`. Trước đây mỗi script tự viết một bản; lệch nhau thì
  việc khớp tên ở hai chỗ ra kết quả khác nhau.
- **`lib/import/cells.ts`** — đọc ô Excel + `SheetLike`. Chỗ quan trọng nhất: ô **công
  thức** của ExcelJS trả về `{formula, result}`, chỉ kiểm `typeof === "number"` là mọi
  ô công thức thành null — mà file dự toán thì đầy công thức.
- **`lib/import/types.ts`** — `ImportPreview` / `ImportResult`, chung cho mọi loại.

Bảo vệ: tài nguyên `import` trong RBAC, **chỉ ADMIN/Quản lý**. Kiểm tra quyền ở **cả
hai** server action, không chỉ ở trang. Giới hạn 10MB (xem 26.4), chỉ nhận `.xlsx`/`.xls`.
`payload` đi vòng qua client nên khi quay lại **luôn được zod validate lại** — không
tin dữ liệu client gửi lên.

## 26.1 Nhập Dự toán chi tiết

Cổng từ `scripts/import-estimates.ts`. Sheet `TongHop`, mỗi file = 1 dự án.

Khớp dự án: tên đầy đủ trước, rồi tới phần `K..L..` rút từ tên file. Không khớp thì
tạo dự án mới mã `DT01`, `DT02`...

`$transaction` bọc `deleteMany` + `createMany` — nếu không, lỗi giữa chừng sẽ **xóa
trắng dự toán** của dự án mà không ghi lại được gì.

### Kiểm chứng trên 15 file thật

511 dòng, 0 file lỗi. Đối chiếu với dữ liệu script cũ đã ghi vào DB: **6/6 file so
sánh được khớp chính xác số dòng, 0 lệch**.

### Hai điều lộ ra khi làm

**Cảnh báo từng dòng là vô dụng.** Ban đầu tôi liệt kê từng dòng thiếu thành tiền →
file nào cũng chạm trần 20 cảnh báo. Gộp thành một, và nhờ vậy mới thấy điều đáng giá:
`K10L50_KT` có **75 dòng có tên nhưng không có tiền**, chỉ 2 dòng thật — gần như là
file mẫu rỗng. Script cũ nhập 2 dòng trong im lặng.

**"Lợp tôn" xếp vào Nhân công, không phải Tôn.** Test của tôi ban đầu tưởng là bug.
Tra dữ liệu thật: cả 26 dòng chứa "lợp" đều là "Lợp tôn" — công lắp đặt, nên phân loại
hiện tại **đúng**. Đã ghi comment + test để lần sau không ai "sửa" nhầm.

## 26.2 Nhập Tổng hợp chi phí (quyết toán)

Cổng từ `scripts/import-thcp.ts` (493 dòng, script phức tạp nhất). Mỗi file = 1 dự án
→ `CostSummary` + `CostCategory` (A–K) + `CostItem`.

### Hai dạng file khác hẳn nhau, nằm chung một thư mục

| Dạng | Đặc điểm | Số file thật |
|---|---|---:|
| **Quyết toán** | bảng hạng mục A–K có NCC / giá trị / thanh toán / hóa đơn, kèm phần "Chi tiết chi phí" | 5 |
| **Sổ giá thành** | sổ kế toán, chỉ có danh sách chi phí và doanh thu, **không có mã hạng mục** | 13 |

`laSoGiaThanh()` phân biệt bằng tiêu đề trong 8 dòng đầu. Chọn nhầm nhánh thì bóc ra
**rỗng chứ không báo lỗi** — nên đây là chỗ được test kỹ nhất.

Với sổ giá thành, nhóm chi phí phải **suy ra từ cột tiền** (cột NVL → vật tư, cột NC →
nhân công, còn lại → khác). Thô, nhưng đó là tất cả những gì file cho biết. Bản xem
trước **luôn nói rõ** đây là suy đoán, không phải số liệu có sẵn trong file.

### Ba chỗ dễ sai đã xử lý

1. **Ô tỷ lệ % nằm cạnh ô tiền.** Dòng Doanh thu trong sổ có ô `0,15` ngay bên cạnh.
   Lấy "ô cuối cùng có số" là vớ phải số %, nên dùng ô có **trị tuyệt đối lớn nhất**.
2. **Cột "Thành tiền" đổi chỗ tùy file** — quét từ trái sang phải lấy số phải nhất.
3. **LNTT trong sổ đôi khi lệch.** Tính lại `doanh thu − tổng chi tiết` thay vì đọc
   thẳng, để con số tổng luôn khớp với phần chi tiết hiển thị bên dưới.

### Đối chiếu chi tiết với số tổng

Bản xem trước tự so tổng các dòng chi tiết với ô "Chi phí" ghi sẵn trong file. Lệch
quá 1% thì cảnh báo. Đây là thứ script CLI cũ không hề làm.

### Khớp dự án — chỗ nguy hiểm nhất

Khớp sai không chỉ là nhập hỏng: nó **ghi đè quyết toán của dự án khác**, và không
hoàn tác lại được. Vì vậy `khopDuAn()` được tách thành **hàm thuần** để test và để
kiểm chứng được trên dữ liệu thật.

Hai bước, theo đúng script cũ:

1. tên dự án trùng khít phần kích thước (`K20L50`);
2. tên dự án **chứa** kích thước **và** địa điểm trùng nhau một phần.

Bước 2 lỏng nên chỉ dùng khi **cả hai bên đều có địa điểm** — nếu không, hai nhà cùng
kích thước ở hai tỉnh khác nhau sẽ bị gộp làm một.

> **Khác script cũ một điểm:** khi bước 2 ra **nhiều** ứng viên, script cũ lấy cái đầu
> tiên trong danh sách. Ở đây thì từ chối đoán, liệt kê mã các dự án trùng và để người
> dùng quyết. Thà tạo dự án mới (sửa được) còn hơn ghi đè nhầm (không sửa được).

### Ghi nhật ký

Mục 25.3 của Phase 25 có ghi: *"CostSummary không có điểm ghi vì hiện chỉ nhập bằng
script CLI... Khi nào làm mục nhập Excel qua web thì phải bổ sung."* Đã bổ sung —
mỗi lần nhập ghi một `AuditLog` (`CREATE` nếu tạo dự án mới, `UPDATE` cho quyết toán).

### Hai điều cố ý KHÔNG cổng sang

- **Xóa dự án tên rỗng.** Script cũ mở đầu bằng `deleteMany({ where: { name: "" } })`
  để dọn rác của một lần chạy hỏng trước đó. Một thao tác xóa hàng loạt không liên
  quan gì tới file đang nhập thì không có chỗ trong một nút bấm trên web.
- **Chế độ `DRY_RUN`.** Bước "xem trước" đã chính là dry-run, và còn tốt hơn: nó hiện
  ra kết quả thay vì in ra terminal.

### Kiểm chứng trên 18 file thật

Chạy bộ bóc tách mới trên toàn bộ `AppQLDA/THCPMau/`, đối chiếu với 18 `CostSummary`
mà script CLI đã ghi vào DB:

| Kiểm tra | Kết quả |
|---|---|
| Số dòng chi phí | **18/18 khớp chính xác** |
| Doanh thu | **18/18 khớp** |
| Chi phí | **18/18 khớp** |
| Nhận dạng dạng file | 5 quyết toán + 13 sổ giá thành, đúng như script cũ |
| **Khớp đúng dự án** | **18/18 đúng mã** — 0 dự án bị tạo trùng, 0 gán nhầm |

Phép kiểm cuối là quan trọng nhất: nếu khớp hụt thì mỗi lần nhập lại đẻ ra một dự án
trùng; nếu khớp nhầm thì ghi đè quyết toán dự án khác.

Một phát hiện phụ: `THCP 20X20 Tuyen Quang.xlsx` **không có dòng Doanh thu** nên LNTT
để trống. Script cũ ghi doanh thu 0 mà không nói gì; giờ có cảnh báo.

## 26.3 Nhập Đơn đặt hàng vật tư

Cổng từ `scripts/import-orders.ts`. Một file = một đơn, nhưng trải trên **nhiều
sheet** (mỗi sheet một loại vật tư) → `PurchaseOrder` + `PurchaseOrderItem` +
`PoItemImage`.

### Ba chỗ khác hẳn hai bộ nhập trước

**1. Vị trí cột không cố định.** Mỗi file đặt hàng một kiểu, nên `doCot()` phải dò
dòng tiêu đề để biết cột nào là "SL", cột nào là "Trọng lượng". Cố định chỉ số cột là
hỏng ngay file thứ hai.

**2. File có ảnh nhúng.** Ảnh biên dạng được chèn ngay dưới dòng vật tư mà nó minh
họa; `ganAnhVaoDong()` gắn mỗi ảnh vào dòng gần nhất **phía trên** trong cùng sheet.
Ảnh nằm trên dòng tiêu đề là logo công ty, bỏ.

**3. Bước xác nhận phải GỬI LẠI FILE.** Đây là điểm thiết kế đáng nói nhất. Hai bộ
nhập trước gửi dữ liệu đã bóc vòng qua client rồi nhận ngược lên. Với đơn hàng thì
không được: ảnh biên dạng của **một** đơn đã tới ~900KB, gửi vòng như vậy là vượt giới
hạn body của server action và tốn băng thông vô ích.

Nên `ImportPreview` có thêm cờ `canFileKhiXacNhan`. Khi bật, giao diện giữ lại
`File` vừa xem trước và gửi lại lúc xác nhận; server **bóc lại từ đầu** thay vì tin
payload. Payload lúc này chỉ mang *quyết định* (`projectId`) cộng `fileName` +
`fileSize` + `soDong` để **đối chiếu**: nếu file lúc xác nhận khác file đã xem
trước, từ chối ghi. Người dùng đã duyệt một nội dung cụ thể — ghi một nội dung khác
vào là phản bội đúng cái họ vừa xác nhận.

Phụ thêm: bóc lại server-side thì dữ liệu ghi vào DB **không thể** bị client sửa, chặt
hơn cả cách zod validate lại của hai bộ trước.

### Đơn hàng KHÔNG tự tạo dự án mới

Khác hai bộ nhập trước. Một đơn đặt hàng luôn thuộc về một dự án đã có, và tên file
thì không đủ thông tin để dựng một dự án tử tế (không có địa điểm, không có chủ đầu
tư, không có giá trị). Không khớp được thì bản xem trước vẫn hiện đầy đủ, nhưng
`payload = null` và **nút xác nhận bị khóa** kèm lời giải thích.

### Kiểm chứng trên 26 file thật

Chạy trên toàn bộ `2_DuAn/RaDonHang/@2026/*/MH/`, đối chiếu 6 đơn mà script CLI đã
ghi vào DB:

| Kiểm tra | Kết quả |
|---|---|
| Số dòng vật tư | **6/6 khớp chính xác** |
| Số ảnh biên dạng gắn được | **6/6 khớp** (17, 22, 25 ảnh…) |
| Giá trị đơn và tổng trọng lượng | **6/6 khớp** |
| Khớp đúng dự án | **6/6 đúng mã** |
| File chưa từng nhập được | **20 file** — đây chính là phần script CLI bỏ sót |

Con số 20 đáng chú ý: script CLI cắm cứng 4 thư mục trong mã nguồn, mà **cả 4 thư mục
đó nay đã bị đổi tên**. Nói cách khác script đó hiện chạy là không ra gì. Bản web nhận
file trực tiếp nên không có vấn đề này.

Một phát hiện: **phần lớn đơn hàng thật không có cột thành tiền** — chúng chỉ theo dõi
khối lượng. Điều đó hợp lệ, nhưng bản xem trước nói rõ "giá trị = 0" để không ai tưởng
số tiền bị bóc sót.

## 26.4 Một lỗi tự phát hiện: giới hạn 1MB của server action

Đang làm phần 3 thì phát hiện phần 1 và phần 2 **đã có lỗi từ lúc giao**.

Next mặc định chỉ cho body của server action tối đa **1MB**. Trang `/import` gửi
nguyên file Excel qua server action, mà file thật thì:

| Kho | File lớn nhất |
|---|---|
| `THCPMau/` | **5,9MB** (THCP 20X30 Hà Tĩnh a Duyên) |
| `DuToanMau/` | **1,8MB** (K16L20_DB) |

Nghĩa là **phần lớn file thật sẽ hỏng** khi tải lên, dù `import/actions.ts` tự đặt
giới hạn 20MB — Next chặn trước, và lỗi báo ra thì khó hiểu.

Đã sửa: `serverActions.bodySizeLimit = "12mb"` trong `next.config.ts`, và hạ giới
hạn của app xuống **10MB** cho khớp. Cố ý không đặt cao hơn mức thực sự cần, vì cấu
hình này áp cho **mọi** server action chứ không riêng trang nhập.

## 26.5 Xuất PDF báo giá / hợp đồng

**Không thêm thư viện PDF nào.** Trang in là một trang HTML tối ưu cho khổ A4; người
dùng bấm "In / Lưu PDF" và chọn *Lưu thành PDF* trong hộp thoại in sẵn có của trình
duyệt.

Lý do chọn cách này thay vì `pdfkit`/`puppeteer`:

| | Trang HTML in | Thư viện PDF |
|---|---|---|
| Phông chữ tiếng Việt có dấu | trình duyệt lo | phải nhúng font, hay lỗi dấu |
| Ngắt trang, lặp tiêu đề bảng | CSS `@page` + `thead` | tự tính |
| Xem trước trước khi lưu | có sẵn | phải tự dựng |
| Kích thước gói cài | 0 | +vài chục MB (puppeteer kéo cả Chromium) |
| Chạy được trên Vercel | có | puppeteer rất phiền |

Đánh đổi: người dùng phải tự tắt phần đầu/chân trang của trình duyệt trong hộp thoại
in — CSS không tắt hộ được. Câu hướng dẫn đã ghi ngay cạnh nút bấm.

### Hai đường dẫn mới

- `/projects/[id]/quote/[quoteId]/print`
- `/projects/[id]/contract/[contractId]/print`

Cả hai nằm trong nhóm route **`(print)`, cố ý KHÔNG dùng `AppShell`**. Sidebar, thanh
trên, nút thêm nhanh đều vô nghĩa trên giấy; bọc rồi ẩn bằng CSS thì vẫn phải tải và
dựng cả cây đó. Vẫn được `proxy.ts` chặn đăng nhập, và mỗi trang tự gọi
`requireProjectView` để kiểm quyền theo dự án.

> **Một lỗ hổng đã bịt ngay khi viết:** quyền được kiểm theo `[id]` trên thanh địa chỉ,
> nhưng báo giá thì tra theo `[quoteId]`. Nếu không kiểm `quote.projectId === id` thì
> chỉ cần đổi `quoteId` trên URL là đọc được báo giá của dự án mình **không** được phân
> công. Cả hai trang đều có dòng kiểm này.

Nút "In / PDF" hiện với **mọi người xem được**, không gắn với quyền sửa — đã cho xem
thì cho in.

### `docTienVietNam()` — dòng "Bằng chữ"

Báo giá và hợp đồng tiếng Việt bắt buộc có dòng này. Hàm thuần, **15 test**.

Chỗ dễ sai nhất, và tôi đã viết sai ở lần đầu: **từ tỷ trở lên không chia tiếp** thành
"nghìn tỷ", "triệu tỷ" như cách chia nhóm 3 chữ số máy móc. Tiếng Việt gộp toàn bộ
phần trên 10⁹ thành một con số rồi mới đọc "tỷ":

```
1.500.000.000.000  →  "Một nghìn năm trăm tỷ đồng"
                  ✗  "Một nghìn tỷ năm trăm tỷ đồng"   ← bản đầu của tôi
```

Các chỗ khác đã xử lý: ba biến âm bắt buộc (21 "mốt", 24 "tư", 25 "lăm"); "linh" chỉ
xuất hiện sau hàng trăm; nhóm 0 ở **giữa** vẫn phải đọc (1.000.005 = "một triệu không
trăm linh năm") nhưng nhóm 0 ở cuối thì bỏ hẳn (1.000.000 = "một triệu").

Đã chạy trên **toàn bộ 15 hợp đồng thật** trong DB — mọi giá trị đọc ra đúng.

### Thông tin công ty

Đặt qua biến môi trường (`COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_PHONE`,
`COMPANY_EMAIL`, `COMPANY_TAX_ID`, `COMPANY_WEBSITE`), có giá trị mặc định. Cố ý không
làm thành bảng trong DB: một dòng dữ liệu gần như không bao giờ đổi, thêm cả model +
trang quản trị chỉ để sửa số điện thoại thì đắt hơn giá trị nó mang lại.

---

## Kiểm chứng chung

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 vấn đề |
| `npm test` | ✅ **267/267** (thêm 111 test so với Phase 25) |
| `npm run build` | ✅ có route `/import` |
| Dự toán: 15 file thật | ✅ 511 dòng, 6/6 đối chiếu khớp |
| THCP: 18 file thật | ✅ 18/18 khớp số liệu **và** khớp đúng dự án |
| Đơn hàng: 26 file thật | ✅ 6/6 đối chiếu khớp (kể cả số ảnh); 20 file mới nhập được |
| Đọc tiền thành chữ trên 15 hợp đồng thật | ✅ đúng toàn bộ |

**Chưa kiểm chứng được:** giao diện `/import` trên trình duyệt (cần đăng nhập), và
chưa thực sự bấm "Xác nhận" trên DB thật — mới chỉ chạy đến bước bóc tách + khớp.

## Việc còn lại của Phase 26

1. **Tìm kiếm toàn cục** (Ctrl+K).
2. **Báo cáo theo kỳ** (tháng / quý).

Ba bộ nhập còn lại (hợp đồng, bảng đơn giá, báo giá mẫu) **cố ý để nguyên ở CLI**: đó
là việc làm một lần lúc dựng dữ liệu, không phải việc lặp lại hằng tuần như ba bộ đã
chuyển lên web.
