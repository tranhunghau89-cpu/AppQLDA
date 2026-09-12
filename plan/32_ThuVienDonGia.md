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

## Phase sau

4. Gợi ý giá theo khu vực, đóng băng giá trên dòng báo giá, huy hiệu cảnh báo lệch giá
5. Bộ hạng mục chuẩn — hấp thụ `EstimateTemplate*` **và** `QuoteTemplate*` vào một khuôn
6. Nối xuống dự toán thi công qua `CongTac.nhomChiPhi`
7. Nhập Excel thư viện · dọn các bảng cũ
