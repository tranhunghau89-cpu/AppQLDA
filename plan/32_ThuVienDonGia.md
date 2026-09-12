# Phase 32 — Thư viện đơn giá dùng chung (giai đoạn 1)

## Vì sao

Trước phase này, app có **ba kho dữ liệu chồng lấn** và không kho nào là nguồn thật:

| Kho | Dữ liệu | Vấn đề |
|---|---|---|
| `WorkPrice` | 135 dòng | Chỉ **một** đơn giá duy nhất. Sửa giá là mất giá cũ — không trả lời được "ngày ký báo giá đó đơn giá bao nhiêu" |
| `QuoteTemplate*` | 2 mẫu / 2 dòng | Rỗng dữ liệu nhưng gánh mặc định văn bản gửi khách ở 8 file |
| `EstimateTemplate*` | 5 mẫu / 90 dòng | Khung dự toán thi công, `applyEstimateTemplate` đang dùng thật |

Hệ quả: khối lượng nhập lại ở ba nơi; giá đổi theo thời gian và theo tỉnh (mỗi công trình một tỉnh, mua của nhà cung cấp khác nhau) nhưng không có chỗ ghi nhận.

Đích đến là **một thư viện duy nhất** — Công tác · Vật tư · Đơn giá · Bộ hạng mục — cho cả dự toán chào giá, báo giá gửi khách và dự toán thi công. Phase này giao **lõi công tác + đơn giá theo thời gian**; khu vực, vật tư, bộ hạng mục ở các phase sau.

## Quyết định thiết kế

**Đơn giá tách khỏi công tác, và không sửa tại chỗ.** Đổi giá là thêm một dòng `DonGiaCongTac` với `hieuLucTu` mới; dòng mới tự thay dòng cũ theo luật "hiệu lực ≤ ngày, lấy mới nhất".

**Không có `hieuLucDen`.** Thêm nó là tạo nguồn sự thật thứ hai cho cùng một việc, và sinh lỗi biên. Công tác ngừng dùng thì tắt `CongTac.active`.

**Hai cột khóa cho phép null, null nghĩa là "áp dụng chung"** — `congTacVatTuId = null` là mọi biến thể vật liệu, `khuVucId = null` là toàn quốc. Nhờ vậy 135 công tác chuyển sang dùng được ngay khi chưa khai vật tư hay khu vực nào.

**`KhuVuc` tạo rỗng ngay từ phase này**, chưa có giao diện. Thêm cột khóa ngoại vào bảng đã có dữ liệu tốn kém hơn nhiều so với dựng sẵn một bảng rỗng.

**Luật chọn giá là hàm thuần** (`src/lib/thuVien/gia.ts`), không nhét vào câu truy vấn — để test được. Dòng khai một biến thể/khu vực **khác** cái đang hỏi thì bị **loại hẳn** chứ không hạ điểm: giá tôn Hoa Sen ở Tây Ninh không phải ước lượng tồi cho tôn Đông Á ở Hà Nội, nó là giá của thứ khác.

**Kết quả trả về kèm `doKhop`** (`BIEN_THE_KHU_VUC` / `BIEN_THE` / `KHU_VUC` / `CHUNG` / `KHONG_CO`) để giao diện trung thực: hiện "185.000 đ — giá chung toàn quốc" thay vì một con số trần.

**Chỉ ADMIN sửa thư viện** (resource `thuVien` trong `src/lib/rbac.ts`); bốn vai còn lại chỉ xem. Thư viện là dữ liệu toàn cục nên không dính `src/lib/scope.ts`.

**Chống trùng bản giá bằng 4 chỉ mục RIÊNG PHẦN viết tay**, không dùng `@@unique` của Prisma: Postgres coi hai NULL là **khác nhau** trong ràng buộc UNIQUE, nên một `@@unique` gộp cả 4 cột sẽ để lọt đúng cái trùng hay xảy ra nhất — hai dòng "giá chung" cùng ngày.

## Chuyển đổi dữ liệu

`CongTac.id = WorkPrice.id` và `CongTac.ma = WorkPrice.code` **nguyên văn**. `QuoteItem.workCode` trỏ vào danh mục bằng chuỗi mã (tham chiếu mềm), nên giữ nguyên mã làm 72 dòng báo giá đang có tự khớp catalog mới mà không phải sửa một byte dữ liệu. Dùng lại id còn làm câu INSERT chạy lại được miễn phí.

`hieuLucTu` của bản giá chuyển đổi là **ngày hằng số `2020-01-01`**, không phải `NOW()`. Migration phải sinh ra cùng kết quả trên mọi môi trường bất kể chạy ngày nào; và ngày này sớm hơn mọi báo giá đang có nên tra giá theo ngày của một báo giá cũ vẫn tìm thấy.

`nhomChiPhi` suy từ `nhomMa` theo bảng ánh xạ đã chốt (AA→KCT, AB→BL_NEO, AC→BLLK, AD→TON, **AF→TON** vì sàn decking mua cùng nhà cán tôn, AE→VT_PHU, AG→VAN_CHUYEN, AK→NHAN_CONG, AL→KHAC). Đây là **giá trị khởi tạo**, ADMIN sửa trên từng công tác được — sai ở đây không sai tiền, chỉ sai nhóm.

**`WorkPrice` ở lại nguyên vẹn, chỉ gỡ đường ghi.** Nó chỉ bị xóa ở một release riêng sau khi thư viện mới đã chạy đủ lâu để đối soát.

## Ràng buộc đã giữ

**516 dòng `EstimateItem` trên 124 dự án không bị đụng tới.** Kiểm bằng:

```bash
grep -v '^\s*--' prisma/migrations/<thư mục>/migration.sql | grep -in estimateitem
```

Phải bỏ dòng chú thích trước khi tìm, nếu không phép kiểm sẽ tự bắt lấy chính câu comment "không đụng EstimateItem" và báo động giả.

`QuoteTemplate*` và `EstimateTemplate*` **giữ nguyên**, chưa xóa gì.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/schema.prisma` | 3 model: `KhuVuc`, `CongTac`, `DonGiaCongTac` |
| `prisma/migrations/20260912090000_thu_vien_cong_tac/` | Tạo bảng, chỉ mục, 4 chỉ mục riêng phần chống trùng |
| `prisma/migrations/20260912091000_chuyen_doi_work_price/` | Chuyển 135 dòng, chỉ thêm, chạy lại được |
| `src/lib/thuVien/gia.ts` + `.test.ts` | Luật chọn giá, phát hiện trôi giá — thuần, 24 test |
| `src/lib/thuVien/napGia.ts` | Phần chạm cơ sở dữ liệu, bọc `cache()`, 2 truy vấn cho cả danh mục |
| `src/lib/constants.ts` + `.test.ts` | `NHOM_MA_SANG_NHOM_CHI_PHI`, `nhomChiPhiTheoNhomMa`, `DON_GIA_NGUON` |
| `src/lib/rbac.ts` | Resource `thuVien` |
| `src/lib/audit.ts` | Thực thể `CongTac`, `DonGiaCongTac` + nhãn trường |
| `src/app/(app)/thu-vien/` | Danh sách công tác + trang lịch sử giá + 4 server action |
| `src/app/(app)/catalog/page.tsx` | Chuyển hướng sang `/thu-vien` (giữ đường dẫn cũ vì nó nằm trong bookmark và tài liệu đã in) |
| `.../quote/napDuLieu.ts`, `.../quote/actions.ts` | Dự toán, "Tính lại giá" và "Chép báo giá" đọc thư viện mới |
| `src/app/(app)/search-actions.ts` | Ctrl+K tra công tác, dẫn thẳng tới trang lịch sử giá |
| `scripts/kiem-tra-chuyen-doi-thu-vien.ts` | Đối soát sau chuyển đổi (chỉ đọc) |
| `scripts/e2e-check.ts` | Kịch bản 6: ai cũng xem được, chỉ ADMIN thấy nút sửa |

## Kiểm chứng

- `npm test` — 589 test xanh (560 cũ + 29 mới), không test nào cũ bị đỏ
- `npm run typecheck`, `npm run lint`, `npm run build` — sạch
- `npm run kiemtra:thu-vien` sau khi chạy migration — đối chiếu số công tác, tổng đơn giá, mã trong báo giá tra ngược được, và `EstimateItem` vẫn đúng 516 dòng

---

# Giai đoạn 2 — Khu vực, nhà cung cấp, vật tư, biến thể

## Vì sao

Vị trí công trình tác động tới tiền **qua nhà cung cấp**: làm ở Hà Nội mua của nhóm này, ở Tây Ninh mua của nhóm kia, hai nhóm báo giá khác nhau. Giai đoạn 1 đã có chỗ để đơn giá gắn khu vực (`DonGiaCongTac.khuVucId`), nhưng chưa có khu vực nào để gắn vào. Giai đoạn này nạp được dữ liệu cho cả ba trục còn thiếu.

## Quyết định thiết kế

**`NhaCungCapKhuVuc` là bảng nối tường minh**, không dùng quan hệ nhiều-nhiều ngầm của Prisma — cần `uuTien` để biết NCC nào gợi ý trước. Một NCC phục vụ nhiều vùng (Hoa Sen, Hoà Phát bán toàn quốc); ép chọn một-một là ép người dùng tạo bản ghi trùng.

**`Quote.khuVucId` là cột RIÊNG, không đọc qua `Project`.** Một bản dự toán sống được ở `CoHoi`, lúc đó chưa có dự án nào để hỏi. `Project.location` text tự do giữ nguyên: nó là địa chỉ, không phải phân vùng.

**Biến thể (`CongTacVatTu`) mới là thứ mang đơn giá, không phải `VatTu` trần.** Cùng một loại tôn, lợp mái và thưng vách là hai đơn giá khác nhau.

**`GiaMuaVatTu` tách khỏi `DonGiaCongTac` và không suy ra nhau.** Giá mua là một *sự kiện* về nhà cung cấp; đơn giá công tác là một *quyết định* của người lập dự toán (đã chốt: đơn giá trọn gói, không bóc định mức). Nối bằng công thức sẽ làm giá bán nhảy mỗi lần ai đó cập nhật một báo giá vật tư.

**Hai luật chọn giá KHÁC nhau, và gộp làm một là sai** — `chonGiaMua` trong `src/lib/thuVien/nhaCungCap.ts`:

- Trong **cùng** một nhà cung cấp, bản giá mới **thay** bản cũ — họ vừa báo giá lại, giá cũ không mua được nữa. Mới nhất thắng, kể cả khi đắt hơn.
- **Giữa** các nhà cung cấp, mỗi bên là một lựa chọn song song đang cùng hiệu lực. Câu hỏi đúng là "mua chỗ nào rẻ nhất".

Nên thu gọn theo nhà cung cấp trước (lấy bản mới nhất của từng bên), rồi mới so rẻ. So thẳng toàn bộ sẽ ra một con số không mua được ở đâu cả.

**`nhaCungCapTheoKhuVuc(links, null)` trả về TẤT CẢ, không phải rỗng.** Chưa khai khu vực cho dự án là chuyện thường (124 dự án cũ đều thế); thu hẹp xuống rỗng lúc đó là làm người dùng không chọn được ai.

**Xóa khu vực / biến thể / vật tư đang mang giá bị CHẶN ở tầng action**, không để khóa ngoại `Cascade`/`SetNull` âm thầm dọn hộ: xóa một khu vực đang có bảng giá riêng sẽ làm những đơn giá đó lặng lẽ thành giá chung toàn quốc — sai tiền mà không ai thấy.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/schema.prisma` | 4 model: `NhaCungCapKhuVuc`, `VatTu`, `CongTacVatTu`, `GiaMuaVatTu`; `Project.khuVucId`, `Quote.khuVucId`; siết khóa ngoại cho `DonGiaCongTac.congTacVatTuId` |
| `prisma/migrations/20260912100000_thu_vien_khu_vuc_vat_tu/` | Chỉ thêm; 2 cột mới đều NULL không DEFAULT nên Postgres không viết lại bảng |
| `src/lib/thuVien/nhaCungCap.ts` + `.test.ts` | `nhaCungCapTheoKhuVuc`, `chonGiaMua` — thuần, 14 test |
| `src/app/(app)/thu-vien/khu-vuc/` | Khai khu vực + lưới tích ô gán NCC (ghi cả cụm trong một giao dịch) |
| `src/app/(app)/thu-vien/vat-tu/` | Danh mục vật tư + giá mua theo NCC/khu vực/thời điểm, bung ra xem |
| `.../cong-tac/[id]/BienTheEditor.tsx` + `bienTheActions.ts` | Khai biến thể vật liệu, đặt biến thể mặc định |
| `.../cong-tac/[id]/DonGiaTimeline.tsx` | Bản giá khai được cho biến thể / khu vực cụ thể; thêm cột "Áp dụng cho" |
| `src/lib/audit.ts` | 5 thực thể mới + nhãn trường |

## Kiểm chứng

- `npm test` — 603 test xanh; `typecheck`, `lint`, `build` sạch
- Migration thử trên CSDL nháp trước, rồi mới tới production
- Thủ công trên bản production build: hỏi giá **chung** cho AD.210 (có 4 bản giá) chọn đúng bản 185.000 "mọi vật liệu, mọi vùng"; ba bản khai riêng MB / Hoa Sen / Hoa Sen+MN đều bị loại. Biến thể Hoa Sen hiện đơn giá riêng 196.000 (không phải 203.000 của MN); biến thể Đông Á chưa khai giá hiện "Dùng giá chung".
- Giá mua: ncc rẻ hơn được gắn cờ "Tốt nhất" đúng cho cả hai vật tư
- SALES mở được cả hai màn mới, không thấy nút sửa nào, ô tích bị khoá

---

---

# Giai đoạn 3 — Gợi ý giá theo khu vực, đóng băng giá, cảnh báo lệch

## Vì sao

Hai giai đoạn trước dựng được kho giá nhiều chiều, nhưng dự toán vẫn chưa dùng tới: nó lấy một con số duy nhất theo mã, không biết khu vực lẫn vật liệu, và không lưu lại mình đã lấy từ đâu. Giai đoạn này nối thư viện vào chỗ thật sự ra tiền.

## Quyết định thiết kế

**`donGiaId` mới là ảnh chụp thật, không phải `donGiaThuVien`.** Con số chỉ nói "giá lúc đó là bao nhiêu"; id bản giá nói được "lấy từ bản nào, hiệu lực từ ngày nào, do ai nhập". Cột số giữ lại để so lệch mà không phải join.

**Lệch giá TÍNH RA mỗi lần tải trang, không lưu cờ.** Một cờ `coTroi` trong CSDL ôi ngay khi ai đó thêm một dòng giá, mà không có job nào làm mới nó.

**`giaSuaTay` suy ra từ CON SỐ, không từ ô tích.** Người dùng gõ giá khác đề xuất là đã nói lên ý mình; bắt tích thêm một ô để xác nhận là thừa. Đây cũng là chỗ duy nhất quyết định cờ đó.

**Huy hiệu lệch giá hiện cho CẢ dòng đã sửa tay**, chỉ có việc *cập nhật* là bỏ qua. Người lập vẫn cần biết thư viện đã đổi; giấu đi là giấu thông tin, không phải bảo vệ.

**Gộp `repriceQuote` (cũ) vào `capNhatGiaTuThuVien` và xóa hàm cũ.** Hai hàm cùng mang nghĩa "tính lại giá" với hai luật khác nhau — cái cũ khớp theo chuỗi mã, bỏ qua khu vực, biến thể lẫn dấu sửa tay — là đúng cái bẫy mà cả kế hoạch này sinh ra để tránh.

**Hàm mới vẫn nhận dòng chỉ có `workCode`** (chưa gắn `congTacId`) và gắn id cho nó khi cập nhật. Không có nhánh này thì 72 dòng lập trước khi có thư viện bị bỏ rơi vĩnh viễn.

**`guard()` thu hẹp kiểu trả về** thành `{ ok: false } | null`. "Chặn thành công" là khái niệm vô nghĩa; khai rộng hơn thực tế bắt mọi chỗ gọi tự ép kiểu.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/migrations/20260912110000_quote_item_dong_bang_gia/` | 6 cột nullable trên `QuoteItem`; khóa ngoại đều **SET NULL** — xóa công tác khỏi thư viện không được xóa dòng báo giá đã lập |
| `.../quote/napDuLieu.ts` | Nạp thư viện kèm biến thể; tính lệch giá cho từng dòng theo khu vực của BẢN dự toán |
| `.../quote/actions.ts` | `goiYDonGia`, `capNhatGiaTuThuVien`, `boDauSuaTay`, `chotGiaThuVien`; `saveQuote` nhận `khuVucId`; gỡ `repriceQuote` |
| `.../quote/ItemModal.tsx` | Chọn công tác → chọn vật liệu → hỏi giá đề xuất kèm nhãn độ khớp; cảnh báo trước khi đánh dấu sửa tay |
| `.../quote/QuoteRows.tsx` | Huy hiệu `→ giá mới` và nhãn `sửa tay` trên từng dòng |
| `.../quote/QuoteCard.tsx` | Đếm dòng lệch giá trên đầu thẻ; nút cập nhật nói rõ sẽ giữ nguyên bao nhiêu dòng sửa tay |
| `projects/ProjectList.tsx`, `projects/actions.ts` | Chọn khu vực cho dự án |
| Nhãn khắp app | "Dự toán chào giá" (Quote) vs "Dự toán thi công & chi phí" (EstimateItem) |
| `QuoteCard` confirm | Hộp xác nhận không-phải-xóa giờ hiện nút xanh "Cập nhật"/"Đẩy giá bán" thay vì nút đỏ "Xóa" |

## Kiểm chứng

Dựng một bản dự toán ở **Miền Nam** có 3 dòng, rồi bấm nút thật trên trình duyệt:

| Dòng | Trước | Sau | Kỳ vọng |
|---|---|---|---|
| Chốt giá cũ, chưa sửa tay (Hoa Sen) | 150.000 | **203.000**, bán 233.450 (×1,15) | Lấy đúng bản khai riêng cho *Hoa Sen + Miền Nam*, thắng cả 196.000 (chỉ biến thể) lẫn 185.000 (giá chung) ✓ |
| Chốt giá cũ, **đã sửa tay** | 175.000 | **175.000 — không đụng** | Bỏ qua, nhưng vẫn hiện huy hiệu lệch ✓ |
| Chỉ có `workCode`, chưa gắn công tác | 99.000 | **185.000** + tự gắn `congTacId` | Đường di trú cho dòng cũ; lấy giá chung vì dòng không khai vật liệu ✓ |

Thẻ báo giá đếm **1** dòng lệch (loại đúng dòng sửa tay). Hộp xác nhận nói: *"Cập nhật 1 dòng đang lệch giá… 1 dòng đã sửa tay sẽ được GIỮ NGUYÊN."*

603 test xanh, `typecheck`/`lint`/`build` sạch.

---

---

# Giai đoạn 4 — Bộ hạng mục chuẩn (gộp hai bảng mẫu cũ)

## Vì sao

App có hai bảng mẫu mô tả **cùng một công trình từ hai phía**: `EstimateTemplate` là các dòng chi phí, `QuoteTemplate` là các dòng in cho khách. Thêm một hạng mục phải sửa hai chỗ, và lệch nhau là chuyện sớm muộn — đúng cái bệnh mà cả thư viện này sinh ra để chữa.

## Ba điều đếm dữ liệu mới thấy

1. **`EstimateSection = 0`** — đường "áp mẫu dự toán" chưa từng được dùng thật; 516 dòng dự toán đều nhập từ Excel. Đổi đường đó ít rủi ro hơn nhiều so với dự đoán ban đầu.
2. Năm mẫu dự toán là **A Khung mái · B Vách · C Canopy · D Nóc gió · E Dầm sàn** — mã A–E cho thấy chúng là **năm phần của một nhà xưởng**, không phải năm loại công trình. Kế hoạch duyệt ban đầu ghi "chuyển 1:1 máy móc"; dữ liệu thật cho thấy 1:1 sẽ ra kết quả vô nghĩa nên đã hỏi lại và chốt gộp thành **một bộ, năm phần**.
3. Hai dòng `QuoteTemplateLine` có `sourceSectionCode` = **"A"** và **"B"** — đúng bằng `code` của hai mẫu dự toán *Khung mái* và *Vách*. Cột đó sinh ra chính để nối hai mặt, nên phép gộp là **cơ học chứ không phải phỏng đoán**.

## Quyết định thiết kế

**Một `BoHangMucPhan` mang HAI mặt**: mặt chi phí (các `BoHangMucDong`) và mặt gửi khách (`inChoKhach` + `tenKhachHang` + `tags` + `partCode`…). Hết cảnh `sourceSectionCode` trỏ bằng chuỗi giữa hai bảng rời nhau.

**Giữ nguyên bốn cột tham số INPUT/DERIVED** trên `BoHangMucDong` — đó chính là lý do `computeTemplateLines` dùng lại được **không sửa một dòng nào**, chỉ đổi tên trường ở chỗ nạp.

**`napMau` đổi NGUỒN nhưng giữ nguyên KHẾ ƯỚC `MauNguon`** — nên `apDungMau`, `deriveLines` và cả đường sinh báo giá khách không phải sửa một chữ. Thay móng mà không dỡ nhà.

**Bảng TSKT giờ trỏ vào `VatTu`**: 32 dòng chữ tự do của hai mẫu gộp còn **19 vật tư** (băm id từ *tên + quy cách* nên dòng trùng cho ra cùng một vật tư — gộp trùng miễn phí và migration chạy lại được). Từ nay sửa quy cách tôn một chỗ là mọi bộ dùng nó cùng đổi.

**`apBoHangMucVaoDuToan` CHỈ áp vào bản còn rỗng.** Trộn một bộ vào bản đã có dòng sẽ sinh phần trùng mã và không ai đoán được kết quả.

**Đơn giá lấy từ THƯ VIỆN theo khu vực của bản**, không lấy `donGiaMacDinh` đã soạn từ lâu trong bộ; số trong bộ chỉ là dự phòng khi thư viện chưa có giá.

**`BoHangMucDong.phanId` là SET NULL**, không CASCADE: xóa một phần không được kéo theo các dòng công tác trong đó — chúng chỉ rơi ra ngoài cây và gắn lại được.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/migrations/20260912120000_bo_hang_muc/` | 6 bảng mới, chỉ thêm |
| `prisma/migrations/20260912121000_chuyen_doi_mau_cu/` | Gộp 2 + 5 mẫu cũ; mọi id tất định (giữ id cũ hoặc băm md5) nên chạy lại không sinh bản sao |
| `src/lib/thuVien/boHangMuc.ts` + `.test.ts` | `dungKhungDuToan`, `dungKhuonGuiKhach` — thuần, 15 test |
| `.../quote/actions.ts` | `apBoHangMucVaoDuToan` |
| `.../quote/QuoteCard.tsx` | Nút + hộp thoại "Áp bộ hạng mục", chỉ hiện trên bản rỗng |
| `src/app/(app)/thu-vien/bo-hang-muc/` | Danh sách bộ, sửa bộ, sửa phần (bật/tắt mặt gửi khách) |
| `src/lib/quoteTemplatePick.ts` | Chọn mẫu đọc từ `BoHangMuc`; `matchTemplate` không đụng tới |
| `.../client-quote/taoBaoGia.ts` | `napMau` đọc bộ hạng mục; TSKT lấy từ `VatTu` |
| `.../estimate/{page,actions}.tsx` | "Mẫu hạng mục" giờ là một PHẦN của bộ |
| `/quote-templates`, `/estimate-templates` | Chuyển hướng về `/thu-vien/bo-hang-muc`; menu gộp còn một lối vào |
| `scripts/kiem-tra-bo-hang-muc.ts` | Đối soát phép gộp (`npm run kiemtra:bo-hang-muc`) |

Tiện thể sửa một khuyết trong cả hai script đối soát: chúng hard-code `EstimateItem = 516` (số của CSDL thật) nên **luôn đỏ trên mọi bản nháp** — mà một phép kiểm lúc nào cũng đỏ là một phép kiểm không ai đọc nữa. Giờ nhận biết môi trường.

## Kiểm chứng

Đối soát 9/9 đạt, và cấu trúc gộp in ra đọc được bằng mắt:

```
[BHM-5BF38E] Nhà xưởng kết cấu thép + bao che — loại: Nhà xưởng · 90 dòng · 16 vật liệu
   A. Khung mái — 32 dòng — gửi khách: 01 Khung thép và tôn phần mái
   B. Vách     — 14 dòng — gửi khách: 02 Phần thưng
   C. Canopy   — 15 dòng — chỉ tính giá vốn
   D. Nóc gió  — 15 dòng — chỉ tính giá vốn
   E. Dầm sàn  — 14 dòng — chỉ tính giá vốn
```

Bấm nút thật trên trình duyệt, áp bộ vào một bản dự toán rỗng ở Miền Nam (hệ số ×1,2): dựng đúng **5 phần A–E** và **90 dòng** theo phân bổ 32/14/15/15/14, giá bán = giá vốn × 1,2 (80.000→96.000, 20.580→24.696), khối lượng để trống. Áp xong nút biến mất — chốt chặn "chỉ áp vào bản rỗng" hoạt động ở cả giao diện lẫn server action.

618 test xanh, `typecheck`/`lint`/`build` sạch.

---

# Phase 6 — Nối xuống dự toán thi công

Báo giá chia theo **đầu việc** (phần khung, phần mái, phần vách); mua hàng chia theo
**thứ phải mua** (thép, tôn, bulong, nhân công). `CongTac.nhomChiPhi` là cây cầu giữa
hai cách chia đó — nó có mặt trong thư viện từ Phase 1 chính vì chỗ này.

## Dữ liệu thật quyết định thiết kế

Đếm trước khi viết, và ba con số đổi hẳn cách làm:

| Đếm được | Hệ quả |
|---|---|
| `QuoteSection` 7 PHẦN + 10 NHÓM, **mã nhóm lặp lại**: mọi phần đều có một nhóm "I — Phần kết cấu thép" | Nhóm KHÔNG thể thành hạng mục: sẽ ra năm hạng mục trùng tên không ai phân biệt nổi |
| 65/72 dòng nằm trong NHÓM, 7 dòng nằm thẳng trong PHẦN | Phải đỡ được cả hai kiểu |
| `QuoteItem.congTacId` = **0/72**, nhưng `workCode` khớp `CongTac` **72/72** | Bắt buộc có nhánh lùi tra theo mã; bỏ nhánh đó là mọi dòng cũ rơi vào nhóm "Khác" |

Nên phép ánh xạ là: **PHẦN → hạng mục, NHÓM tụt xuống `groupLabel`.** Dự toán thi công
phẳng (`EstimateSection` không có cha) và tầng hai của nó vốn nằm ở cột chữ `groupLabel`.

## Quyết định

**Đơn giá lấy giá VỐN, không lấy giá bán.** Dự toán thi công theo dõi tiền bỏ ra.

**Chỉ chèn thêm, không xoá và không sửa dòng nào đang có.** Dự toán thi công là nơi mua
hàng và kế toán ghi trạng thái đặt hàng, xuất hàng, khối lượng thực — một thao tác "đồng
bộ" thông minh sẽ xoá mất chính những thứ đó. Có bước xem trước, và nếu dự án đã có dòng
thì phải tích một ô xác nhận mới bấm được.

**Hạng mục rỗng bị bỏ**, kèm cảnh báo. Một hạng mục không có dòng nào trong dự toán thi
công chỉ tốn một dòng người dùng phải tự xoá.

**Dòng thiếu khối lượng vẫn đổ xuống.** Nó là đầu việc cần nhớ; xoá đi mới là mất mát,
còn để trống thì điền sau được. Số dòng thiếu được nói rõ ở bước xem trước.

**`donGiaId` chỉ đi theo khi giá KHÔNG bị sửa tay.** Cột đó trả lời "con số này lấy từ
bản giá nào"; giá đã gõ đè thì không còn đến từ bản giá ấy nữa, gắn vào là ghi một xuất
xứ sai. `congTacId` thì vẫn giữ — công tác không đổi khi người ta sửa giá.

**Ba cột xuất xứ, không phải hai.** `khuVucId` không thừa bên cạnh `donGiaId`: bản giá
chung toàn quốc có `khuVucId` NULL, nên chỉ cột riêng này mới kể được "lúc lập ta đang
tính giá cho vùng nào". Lập cho Tây Ninh mà phải dùng giá chung là trường hợp thường xuyên.

**Ô chọn nhà cung cấp không lọc bỏ ai** — chỉ đưa nhà cung cấp trong vùng lên nhóm đầu.
Lọc cứng sẽ làm ô rỗng ngay khi một dự án có khu vực mà chưa nhà cung cấp nào được gán vùng.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/migrations/20260912130000_estimate_item_nguon_thu_vien/` | 3 cột nullable trên `EstimateItem`, không DEFAULT, không UPDATE |
| `src/lib/thuVien/doXuong.ts` + `.test.ts` | `doXuongDuToan` — thuần, 16 test |
| `.../estimate/actions.ts` | `xemTruocDoXuong`, `doXuongDuToanThiCong` |
| `.../estimate/DoXuongTuBaoGia.tsx` | Nút + hộp thoại xem trước, ô xác nhận khi đã có dòng |
| `.../estimate/{page,EstimateEditor}.tsx` | Nhà cung cấp tách nhóm theo khu vực dự án |
| `scripts/kiem-tra-*.ts` | Đổi bất biến "dự toán thi công còn nguyên" |

`nhaCungCapTheoKhuVuc` viết từ Phase 2, có test, nhưng **chưa nơi nào gọi** — phase này
mới nối nó vào chỗ dùng thật.

### Một phép kiểm sắp tự đỏ

Cả hai script đối soát chốt cứng `EstimateItem === 516`. Từ khi có nút "Đổ xuống", bảng
lớn lên là chuyện **đúng** — phép kiểm sẽ đỏ ngay lần đầu tính năng chạy thành công, mà
một phép kiểm đỏ lúc chạy đúng còn tệ hơn không có. Bất biến đổi thành **số dòng cũ ≥ 516**,
nhận diện dòng cũ bằng chỗ trống: chúng nhập từ Excel nên không mang xuất xứ thư viện nào.

## Kiểm chứng

`EstimateItem` trước và sau migration trên CSDL thật: **516 dòng · 17 dự án ·
14.628.398.684 đ — giống hệt.** Cả 516 dòng đều NULL ở ba cột mới, tức không có backfill
nào chạm vào chúng.

Bấm nút thật trên trình duyệt với một bản dự toán dựng đúng hình dạng production (cây hai
tầng, mã nhóm lặp, kèm mọi ca biên):

```
A PHẦN KHUNG VÀ MÁI      4 dòng   653.400.000 đ
B PHẦN THƯNG VÁCH        2 dòng    69.700.000 đ
F VẬN CHUYỂN VÀ LẮP ĐẶT  1 dòng    45.000.000 đ
3 hạng mục · khu vực Miền Bắc · 7 dòng · 768.100.000 đ
⚠ Hạng mục "Z — PHẦN RỖNG" không có dòng nào — bỏ qua.
⚠ 1 dòng không tra được công tác trong thư viện — xếp vào nhóm "Khác".
⚠ 1 dòng có giá sửa tay — không gắn nguồn giá thư viện.
```

Sau khi đổ: nhóm "Phần kết cấu thép" xuất hiện dưới **cả hai** hạng mục A và B mà không
lẫn nhau; 4 dòng cũ của dự án nằm nguyên dưới "Chưa phân hạng mục"; bảng "Theo nhóm" tự
tách ra Kết cấu thép / Tôn - Diềm / Nhân công / Khác — tức `nhomChiPhi` đã dẫn đúng.

Đối chiếu trong cơ sở dữ liệu, hai dòng quyết định: *Lợp mái tôn sóng* (giá không sửa)
**có** `donGiaId`, *Tôn mái loại đặc biệt* (giá sửa tay) **không** — dù cả hai cùng trỏ
một bản giá ở nguồn.

Ô chọn nhà cung cấp: `Trong khu vực Miền Nam` → CPR, Hòa Phát (theo ưu tiên) · `Nhà cung
cấp khác` → 11 nhà cung cấp còn lại.

634 test xanh, `typecheck`/`lint`/`build` sạch, hai script đối soát đạt.

---

# Phase 7 — Nhập Excel thư viện

Cho tới đây, cách duy nhất để đổi đơn giá là gõ tay từng mã trên giao diện, và chỉ
ADMIN làm được — nút cổ chai đúng như đã lường trong bảng rủi ro. Phase này mở van.

## Nguồn thật là gì

Kế hoạch ban đầu ghi nguồn là `DuToanMau/`, `THCPMau/`, `TD_DA.xlsx`. **Sai** — hai
thư mục đó là file theo dự án, đã có bộ nhập riêng. Nguồn thật của 135 mã đơn giá là
sheet **"DV"** (Bảng danh mục công việc & đơn giá) trong file báo giá `BG_NX_*.xlsx`.

Bố cục sheet, hàng 4 là tiêu đề, dữ liệu từ hàng 5:

```
A=STT  B=MCV  C=ND  D=Loại  E=TSKT  F=DV  G=VT  H=NC_M  I=HS  J=GT  K=GC
```

Khớp một-đối-một với `CongTac` + `DonGiaCongTac`. Từ cột L trở đi là ô tìm kiếm và
bảng chú giải nhóm của chính file — không phải dữ liệu. Tiện thể, bảng chú giải ấy
(AA=Thép, AB=Bulong neo, AC=Bulong liên kết, AD=Tôn diềm inox, AE=Phụ kiện, AF=Dầm sàn,
AG=Vận chuyển, AK=Lắp đặt) khớp đúng bảng ánh xạ `NHOM_MA_SANG_NHOM_CHI_PHI` đã chốt
lúc phỏng vấn — một xác nhận độc lập rằng ánh xạ đó không phải tôi đoán.

## Con số đổi cả thiết kế

Bốn file bảng giá trải từ 2023 đến 2026, đối chiếu toàn bộ 135 mã:

| File | Đổi giá | Thêm mã | Mất mã |
|---|---|---|---|
| `BG_NX_KL_HN_D1312_25` | **1** (AC.630: 26.500 → 32.500) | 0 | 0 |
| `BG_NX_K35L35_PT_D2903_25` | 0 | 0 | 0 |
| `BG_NX_K30L72_HN_D08_26` | 0 | 0 | 0 |

Bảng giá được **chép từ file báo giá này sang file báo giá khác**, nên hai file cách
nhau ba năm vẫn gần như y hệt. Nếu trình nhập cứ mỗi file chèn 135 bản giá, nhập bốn
file sẽ sinh 540 dòng mà 539 dòng là rác — và lịch sử giá, đúng thứ thư viện sinh ra
để giữ, bị chôn dưới đống trùng lặp.

Nên: **chỉ ghi khi con số thật sự đổi.** Kèm theo đó, nhập lại cùng một file trở nên
vô hại — tính bất biến có được miễn phí, không cần khoá hay cờ "đã nhập".

## Quyết định khác

**Ngày hiệu lực đọc từ tên file** theo quy ước `BG_..._D<ngày><tháng>_<năm>`, có cả
dạng ngắn chỉ tháng (`_D08_26`). Không đọc được thì lùi về hôm nay và **nói rõ trên
màn hình** — đoán bừa một ngày quá khứ sẽ chèn bản giá xuống dưới các bản đã có rồi
âm thầm không có tác dụng gì.

**Bảng xem trước chỉ hiện dòng THẬT SỰ đổi.** Một danh sách 135 dòng mà 134 dòng
"không đổi" thì người duyệt sẽ lướt qua — và đó đúng là lúc một thay đổi sai lọt lưới.

**`ImportPreview.duAn` thành tuỳ chọn.** Thư viện là dữ liệu toàn cục, không thuộc dự
án nào. Thà để trống còn hơn bịa một dự án giả để lấp chỗ: giao diện sẽ hiện một ô
"Dự án đích" nói dối.

**Mã trùng trong cùng file: giữ dòng ĐẦU.** Dòng sau thường là bản nháp bỏ quên bên
dưới; lấy dòng cuối là âm thầm đổi giá của mã đó.

**Nhập không đụng `nhomChiPhi`** của công tác đã có: đó là giá trị ADMIN sửa trên giao
diện, file Excel không biết gì về nó.

## Đã làm

| Tệp | Việc |
|---|---|
| `src/lib/import/thuVien-parse.ts` + `.test.ts` | `bocTachThuVien`, `ngayHieuLucTuTenFile`, `soSanhVoiThuVien` — thuần, 23 test |
| `src/lib/import/thuVien.ts` | `parseThuVien` / `applyThuVien` |
| `src/lib/import/types.ts` | Thêm `thuVien` vào `IMPORT_KIND`; `duAn` thành tuỳ chọn |
| `.../import/{page,actions,ImportWizard}.tsx` | Nối loại mới; ô "Dự án đích" chỉ hiện khi có |
| `scripts/import-pricebook.ts` | **Xoá** |

### Vì sao xoá `import-pricebook.ts`

Script đó ghi vào `WorkPrice` — bảng mà từ Phase 1 **không còn ai đọc**. Nó không
còn là một lối nhập nữa, nó là một cái bẫy: chạy xong thấy báo "135 mã, cập nhật 135"
và tin rằng đã đổi giá, trong khi thư viện không hề thay đổi. Kẻ ghi cuối cùng vào
`WorkPrice` biến mất cùng nó.

## Kiểm chứng

Bấm qua giao diện thật với hai file báo giá gốc:

```
BG_NX_KL_HN_D2504_23.xlsx   135 mã · 131 công tác mới · 2 đổi giá · hiệu lực 25/4/2023
  -> Đã thêm 133 bản giá hiệu lực 25/4/2023 và tạo 131 công tác mới. 2 mã không đổi — bỏ qua.

BG_NX_KL_HN_D1312_25.xlsx   135 mã ·   0 công tác mới · 1 đổi giá · hiệu lực 13/12/2025
  AC.630  Cáp bọc nhựa D20  Đổi giá  26.500 ₫ -> 32.500 ₫
  -> Đã thêm 1 bản giá hiệu lực 13/12/2025. 134 mã không đổi giá — bỏ qua.
```

135 mã vào, **1 dòng** ra. Lịch sử giá của AC.630 trong cơ sở dữ liệu sau đó:

| Hiệu lực từ | Đơn giá | Nguồn |
|---|---|---|
| 25/04/2023 | 26.500 | IMPORT_EXCEL |
| 13/12/2025 | 32.500 | IMPORT_EXCEL |

Màn thư viện hiện đúng giá mới nhất (32.500 · 13/12/2025), và câu hỏi "ngày ký báo
giá đó giá bao nhiêu" từ nay tra được.

657 test xanh, `typecheck`/`lint`/`build` sạch.

---

## Chưa làm: dọn các bảng cũ

Kế hoạch xếp việc DROP `WorkPrice`, `QuoteTemplate*`, `EstimateTemplate*` vào phase
này. **Cố ý để lại**, vì ba lý do:

1. Hai script đối soát (`kiemtra:thu-vien`, `kiemtra:bo-hang-muc`) **đọc chính các
   bảng đó** để chứng minh phép chuyển đổi là trung thực — 135 = 135, tổng đơn giá
   khớp, 90 dòng mẫu về đủ. Xoá bảng là xoá luôn phép kiểm độc lập duy nhất.
2. `migrate deploy` trên Supabase **không lùi được**.
3. Thư viện mới mới sống được vài giờ, và chưa ai khai một khu vực hay một biến thể
   vật liệu nào. Chưa đủ thời gian để tin.

Ba bảng đó tốn khoảng 270 dòng dữ liệu — rẻ hơn nhiều so với việc mất đường đối soát.
Nên xoá trong một release RIÊNG, sau khi thư viện đã chạy thật một thời gian.

Phần **nguy hiểm** của việc dọn dẹp thì đã làm xong: cái script ghi vào bảng chết.

## Bổ sung: gỡ đơn giá trọn gói theo m²

Người dùng phát hiện khi nhìn màn thư viện: nhóm **AL · Gia công khác** (7 mã) không
phải công tác đơn lẻ mà là giá cả một hạng mục tính theo m² —
*"Gia công sản xuất, lắp dựng khung nhà thép Q235 và tôn phần mái — 670.000 đ/m²"*.

Chúng thuộc tầng báo giá m² gửi chủ đầu tư (file gốc có hẳn sheet "BG M2"). Để lẫn
trong danh mục đơn giá là **mời gọi cộng trùng**: một bản dự toán vừa có dòng m² trọn
gói, vừa có các dòng thép, tôn, bulong mà chính dòng m² đó đã bao gồm.

Chúng vào thư viện từ migration chuyển đổi `WorkPrice`, vì bảng cũ không phân biệt
hai loại này.

**Lọc theo NHÓM MÃ, không theo đơn vị.** Đơn vị "m²" không phải dấu hiệu nhận biết:
AD, AF, AK có 18 mã tính theo m² nhưng đều là công tác thật (lợp tôn, thi công tôn
sàn, sàn decking). Cả 7 mã nhóm AL đều là m², và chỉ nhóm AL.

Đối chiếu trước khi xoá: **0 dòng báo giá** (cả `congTacId` lẫn `workCode`), 0 dòng dự
toán thi công, 0 dòng bộ hạng mục, 0 biến thể vật tư nào trỏ vào chúng.

| | Trước | Sau |
|---|---|---|
| `CongTac` | 135 | **128** |
| nhóm AL | 7 | **0** |
| `DonGiaCongTac` | 135 | **128** |
| `EstimateItem` | 516 | 516 |
| Dòng báo giá mất đường về thư viện | 0 | **0** |

Xoá dữ liệu thôi thì lần nhập Excel sau dựng lại y nguyên — sheet DV vẫn chứa chúng.
Nên trình nhập cũng bỏ qua nhóm AL, **đếm và nói ra ở bản xem trước** chứ không lặng
lẽ: người nhập cần biết vì sao 135 mã trong file chỉ vào thư viện 128. Nhãn thống kê
đổi từ "Mã trong file" thành "Mã đưa vào thư viện" — hai con số nay đã khác nhau.

Và một phép kiểm nữa suýt tự đỏ: script đối soát chốt `CongTac = WorkPrice = 135`.
Giờ trừ nhóm AL ở **phía cũ** trước khi so, cộng thêm một phép kiểm mới khẳng định
thư viện không lẫn lại giá trọn gói. Đối soát 6/6 đạt, tổng đơn giá khớp chính xác
(97.770.772,82 = 101.598.772,82 − 3.828.000).

Dữ liệu gốc vẫn còn ở `WorkPrice` và trong sheet DV, nên lấy lại được nếu sau này cần
một chỗ chứa riêng cho giá m².

## Bổ sung: áp bộ hạng mục vào bản đã có, và diện tích từng phần

Chủ dự án nói rõ mô hình: **báo giá m² thực chất là bản thu gọn của báo giá chi tiết**.
Dự toán chào giá lấy nguyên bộ hạng mục chuẩn của dạng nhà tương tự, nhập lại khối
lượng và đơn giá, rồi đó là căn cứ tính giá từng hạng mục cho khách.

Phép suy vốn đã có và đúng:
`đơn giá m² của hạng mục = tổng giá bán của phần tương ứng ÷ diện tích phần đó`.
Hai thứ chặn nó chạy thật:

**1. Chốt "chỉ áp bộ vào bản còn rỗng" (đặt ở Phase 4) chặn đúng cách làm việc thật.**
Người lập gõ một dòng là nút biến mất. Lý lẽ cũ — "trộn một bộ vào bản đã có dòng sẽ
sinh phần trùng mã và không ai đoán được kết quả" — đúng về rủi ro nhưng sai về cách
chữa: cái cần là làm cho kết quả **đoán được**, không phải cấm. Giờ áp bộ **chỉ THÊM
phần còn thiếu**, phần trùng mã giữ nguyên không đụng tới, và có bước xem trước liệt kê
rõ thêm gì / bỏ qua gì.

Phần con của một phần bị bỏ thì cũng bỏ: cha nó không được tạo, mà gắn nó vào phần cùng
mã do người dùng tự tạo là tự ý diễn giải một thứ họ không yêu cầu.

**2. Diện tích từng phần là mẫu số của đơn giá m², nhưng áp bộ xong thì trống hết.**
Mái, vách, canopy mỗi thứ một diện tích khác nhau, nên lùi về "diện tích công trình"
cho cả năm phần là sai. Ô nhập vốn có sẵn trong hộp thoại sửa phần, nhưng phải mở năm
lần. Giờ **hỏi ngay lúc áp bộ**: bảng xem trước có luôn cột diện tích cho từng phần.

Diện tích ≤ 0 coi như chưa khai — nó là mẫu số, một số 0 lọt vào cho ra Infinity trên
bản báo giá gửi khách.

### Đã làm

| Tệp | Việc |
|---|---|
| `src/lib/thuVien/boHangMuc.ts` + `.test.ts` | `locPhanConThieu` — thuần, 8 test |
| `.../quote/actions.ts` | `xemTruocApBoHangMuc`; `apBoHangMucVaoDuToan` nhận bảng diện tích, bỏ chốt "chỉ bản rỗng" |
| `.../quote/QuoteCard.tsx` | Nút hiện cả trên bản đã có nội dung; hộp thoại có bảng nhập diện tích + danh sách phần bỏ qua |

Bước xem trước và bước ghi dùng **chung một hàm nạp** (`khungConThieu`), để hai bên không
thể nói hai chuyện khác nhau — người dùng nhập diện tích cho đúng những phần sẽ được tạo.

### Kiểm chứng

Bản dự toán đã có sẵn một phần `A` gõ tay (150 m², 1 dòng, giá bán 2.400.000 đ), áp bộ
`BHM-5BF38E` (phần A–E):

```
Xem trước:  B Vách 14 dòng · C Canopy 15 · D Nóc gió 15 · E Dầm sàn 14
            "Bản dự toán đã có phần A — giữ nguyên, không áp đè."
Nhập diện tích: B=1.200  C=50  D=30  E=120,5
```

Sau khi áp — phần A còn nguyên tên, dòng và diện tích cũ; B–E thêm mới, xếp sau; diện
tích gán đúng kể cả số kiểu Việt (`1.200` → 1200, `120,5` → 120,5).

Rồi sinh bản gửi khách từ chính bản dự toán đó:

| Dòng | Từ phần | Diện tích | Tổng bán của phần | Đơn giá m² |
|---|---|---|---|---|
| 01 | A | 150 | 2.400.000 | **16.000** |
| 02 | B | 1.200 | 0 | 0 |
| 03 | C | 50 | 0 | 0 |
| 04 | D | 30 | 0 | 0 |
| 05 | E | 120,5 | 0 | 0 |

Cả năm dòng **nối đúng phần** (`sourceSectionId` không còn null), khối lượng bằng diện
tích phần. Bốn dòng cuối bằng 0 vì chưa nhập khối lượng cho các dòng công tác bên trong
— đúng như thiết kế, khối lượng để người lập điền.

668 test xanh, `typecheck`/`lint`/`build` sạch.

# Phase 8 — Thư viện khối lượng & giá vốn theo hạng mục

Chủ dự án nêu mô hình đầy đủ: dự toán cho từng hạng mục để biết **đơn giá vốn/m²**, từ
đó mới quyết định giá bán sao cho đủ lãi. Khối lượng lấy từ **thư viện khối lượng** rút
từ các công trình đã làm.

## Quyết định (phỏng vấn trước khi làm)

| # | Quyết định |
|---|---|
| 1 | Nguồn khối lượng: **nhập tay · lấy từ dự án tương tự · SteelFrame** — mục tiêu là dựng một bộ thư viện khối lượng mẫu |
| 2 | Nhân viên kinh doanh xem giá vốn: **cả hai** — nhìn lướt trên bảng và bấm mở chi tiết |
| 3 | Bốn phiên bản khối lượng (chào giá → thi công → mua hàng → quyết toán): **để sau** |
| 4 | Định mức **chỉ cho KHỐI LƯỢNG**; đơn giá vẫn trọn gói nhập tay như đã chốt |
| 5 | Suất khối lượng tính trên **diện tích của CHÍNH phần đó** |

Quyết định 4 làm rõ một chỗ tưởng như mâu thuẫn với phỏng vấn ban đầu ("không làm bảng
định mức"): định mức cho *khối lượng* và định mức cho *giá* là hai thứ khác nhau. Thư
viện đơn giá không đổi một dòng nào.

## Bốn phát hiện trước khi viết

1. **Phần "giá vốn theo hạng mục" không cần bảng mới nào.** Dữ liệu đã đủ: dòng gửi
   khách → `sourceSectionId` → phần dự toán → các dòng công tác với `qty × baseCost`.
2. **Ô diện tích làm ở lượt trước chính là số nhân** mà thư viện khối lượng cần — thêm
   đúng một cột `suatKhoiLuong`.
3. **Hợp đồng SteelFrame đã soạn nhưng CHƯA triển khai.** `plan/30` ghi "đề xuất, chờ
   chốt hai bên"; `steelFrameKey` trong mã nguồn mới chỉ là trường chuyển tiếp. Để sau.
4. **Đã có `TakeoffItem`** — bảng bóc khối lượng tay theo dự án, chưa nối vào đây.

Và một ràng buộc dữ liệu: muốn tự rút suất bình quân từ mọi công trình cũ thì phải biết
**diện tích từng hạng mục** trong quá khứ, mà `EstimateSection` không có cột đó — chỉ có
`Project.area` cho cả nhà. Nên nguồn "tự tính bình quân" bị loại, còn "lấy từ một dự án
cụ thể" thì làm được vì `QuoteSection.area` đã có.

## Đã làm

| Tệp | Việc |
|---|---|
| `prisma/migrations/20260912150000_suat_khoi_luong/` | 1 cột `BoHangMucDong.suatKhoiLuong` |
| `src/lib/thuVien/boHangMuc.ts` + `.test.ts` | `ropKhoiLuongTheoDienTich`, `rutSuatKhoiLuong` — thuần, 15 test |
| `src/lib/quote.ts` | `sectionSubtotals` nhận hàm tính tiền (mặc định giá bán) → tái dùng cho giá vốn |
| `src/lib/utils.ts` | `formatSuat` — 4 chữ số thập phân |
| `.../quote/actions.ts` | Áp bộ rót khối lượng theo suất × diện tích; xem trước đếm dòng có suất |
| `.../thu-vien/bo-hang-muc/` | `BangSuat` (nhập tay), `LaySuatModal` + `laySuatTuDuToan` (lấy từ dự án đã làm) |
| `.../client-quote/GiaVonPanel.tsx` | Bảng giá vốn theo hạng mục, bung chi tiết công tác, dòng tổng |
| `.../client-quote/napDuLieu.ts` | Tính giá vốn từng phần — một truy vấn cho cả trang, không lưu cứng |

Giá vốn **tính tại chỗ, không lưu**: lưu thì nó ôi ngay lần đầu ai đó sửa một dòng.

## Hai lỗi bắt được khi nhìn màn hình

**Suất 22,5 hiện thành 23.** `formatNumber` làm tròn về số nguyên. Suất là một *tỉ số*
rồi mới đem nhân với diện tích — 22,5 thành 23 là sai 2% trên toàn bộ khối lượng thép.
Thêm `formatSuat` giữ 4 chữ số thập phân.

**Diện tích 120,5 m² hiện thành 121.** Cùng nguyên nhân, đổi sang `formatQty`.

## Kiểm chứng

Bấm nút thật. Gán suất cho 3 dòng của phần Vách (22,5 · 5,2 · 0,8), áp bộ với diện tích
vách 800 m²:

```
Xà gồ            22,5 × 800 = 18.000
Bulong liên kết   5,2 × 800 =  4.160
Ty xà gồ          0,8 × 800 =    640
Ecu ty xà gồ      (không có suất) → để TRỐNG, không bịa số 0
```

Bảng xem trước khi áp bộ hiện huy hiệu **"3 KL"** ở phần Vách.

Bảng giá vốn trên bản gửi khách:

| Hạng mục | Diện tích | Tổng giá vốn | Vốn/m² | Bán/m² | Lãi |
|---|---|---|---|---|---|
| A Phần tôi tự gõ | 150 m² | 2.000.000 ₫ | 13.333 ₫ | 16.000 ₫ | **16,7%** |
| **Cả bản dự toán** | | **2.000.000 ₫** | | 2.400.000 ₫ | **16,7%** |

Bấm vào hạng mục bung ra đúng dòng công tác (*Dòng tôi tự gõ · kg · 100 · 20.000 ₫ ·
2.000.000 ₫*), và chỉ một hạng mục bung một lúc.

683 test xanh, `typecheck`/`lint`/`build` sạch, đối soát bộ hạng mục 9/9 đạt.

## Chưa làm

- **Nhập file SteelFrame** `<mã>-khoiluong.json` — hợp đồng v1 chưa chốt hai bên và
  chưa có file mẫu thật.
- **Bốn phiên bản khối lượng** theo vòng đời — chủ dự án chọn để sau.

---

## Bổ sung: thông tin người phụ trách lấy từ tài khoản

Dải "Thông tin in trên bản báo giá" bắt gõ tay chín ô cho từng bản, trong đó bốn ô
gần như luôn giống nhau: người phụ trách, SĐT, email, hiệu lực — cộng thêm ngày báo
giá vốn luôn là hôm nay.

**Chỗ hỏng thật:** `generateFromQuote` — đường sinh bản gửi khách từ dự toán, tức
đường dùng nhiều nhất — **không gán `salesName`/`salesPhone`/`salesEmail` một dòng
nào**. Nên mọi bản sinh từ đó đều hiện "còn 3 ô chưa điền" và người lập phải gõ lại.
Hai đường tạo còn lại thì có gán tên và email, nhưng không đường nào có SĐT.

**Vì sao không có SĐT:** bảng `User` không có cột số điện thoại. Tên và email lấy được
từ phiên đăng nhập, còn SĐT thì không có nguồn nào — nên mới phải gõ tay. Thêm
`User.phone` là điều kiện để "gắn từ tài khoản" có nghĩa.

**"Mục khác…" chính là thiết lập nâng cao**, và năm ô này đã có sẵn trong đó. Nên việc
cần làm chỉ là bỏ chúng khỏi dải nhập ngoài, không phải dựng thêm màn hình nào.

### Đã làm

| Tệp | Việc |
|---|---|
| `prisma/migrations/20260912160000_user_phone/` | `User.phone` nullable |
| `src/lib/nguoiLapBaoGia.ts` | `thongTinNguoiLap` — một chỗ cho cả ba đường tạo báo giá |
| `.../client-quote/actions.ts` | `generateFromQuote` gán đủ ba dòng phụ trách |
| `.../client-quotes/actions.ts`, `.../co-hoi/.../page.tsx` | Dùng chung helper, có thêm SĐT |
| `.../client-quote/ThongTinIn.tsx` | Dải nhập còn **4 ô về khách**; 5 ô kia lùi vào "Mục khác…" |
| `.../users/` | Ô số điện thoại trong hộp thoại tài khoản |

Dải nhập giữ lại một **dòng chữ mờ** tóm tắt những gì đã lùi vào nâng cao (ngày, hiệu
lực, người phụ trách) — nhìn là biết bản in sẽ ra gì, nhưng không còn là ô bắt phải điền.

### Kiểm chứng

Đặt SĐT cho tài khoản rồi sinh một bản gửi khách mới từ dự toán:

```
Bản MỚI:  Quản trị viên · 0912345678 · admin@cty.com · hiệu lực 7 · 12/09/2026
Bản CŨ:   null · null · null                    (tạo trước khi sửa)
```

Trên màn hình: dải nhập còn đúng 4 ô (Kính gửi · SĐT khách · Địa điểm · Hạng mục), huy
hiệu chuyển từ "còn 3 ô chưa điền" sang **"đã điền đủ"**, và dòng tóm tắt hiện
*"Ngày báo giá 12/09/2026 · hiệu lực 7 ngày · phụ trách: Quản trị viên · 0912345678 ·
admin@cty.com"*.

683 test xanh, `typecheck`/`lint`/`build` sạch.

## Việc còn lại của quản trị viên

1. Khai `KhuVuc` và gán vùng cho 46 nhà cung cấp — mở khoá trục vị trí.
2. Gắn `congTacId` cho 90 dòng trong bộ hạng mục.
3. Khai biến thể vật liệu (`CongTacVatTu`) cho các công tác có nhiều loại tôn/thép.

Việc còn lại của quản trị viên: 90 dòng công tác trong bộ **chưa gắn `congTacId`** (tên là chữ tự do, không có cách khớp tự động an toàn với 135 mã công tác). Gắn dần trên giao diện thì chúng mới ăn được đơn giá theo khu vực/vật liệu.
