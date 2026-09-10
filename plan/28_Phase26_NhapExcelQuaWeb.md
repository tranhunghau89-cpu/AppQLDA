# Phase 26 — Nhập Excel qua web

> Ngày 2026-09-10. Theo `plan/23_RaSoat_KeHoachNangCap.md` mục Phase 26.
> Trạng thái: phần 1 (Dự toán) và phần 2 (Tổng hợp chi phí) đã xong.

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
hai** server action, không chỉ ở trang. Giới hạn 20MB, chỉ nhận `.xlsx`/`.xls`.
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

---

## Kiểm chứng chung

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` | ✅ sạch |
| `npx eslint src` | ✅ 0 vấn đề |
| `npm test` | ✅ **224/224** (thêm 68 test so với Phase 25) |
| `npm run build` | ✅ có route `/import` |
| Dự toán: 15 file thật | ✅ 511 dòng, 6/6 đối chiếu khớp |
| THCP: 18 file thật | ✅ 18/18 khớp số liệu **và** khớp đúng dự án |

**Chưa kiểm chứng được:** giao diện `/import` trên trình duyệt (cần đăng nhập), và
chưa thực sự bấm "Xác nhận" trên DB thật — mới chỉ chạy đến bước bóc tách + khớp.

## Việc còn lại của Phase 26

1. Nhập **Đơn đặt hàng vật tư** (`scripts/import-orders.ts`).
2. **Xuất PDF** báo giá / hợp đồng — làm bằng trang HTML tối ưu cho in, không thêm thư
   viện PDF.
3. **Tìm kiếm toàn cục** (Ctrl+K).
4. **Báo cáo theo kỳ** (tháng / quý).
