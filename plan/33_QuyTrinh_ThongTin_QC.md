# 33 — Quy trình: Điền thông tin dự án + QC theo giai đoạn

Trạng thái: **đã làm cả 3 đợt** (14/10/2026)

## Mục tiêu
Biến phần Thông tin dự án và QC thành chuỗi bước tuần tự. Mỗi bước có người phụ trách, hạn
xử lý, trình duyệt, được duyệt hoặc trả lại. Chỉ **cảnh báo**, không chặn đơn hàng / tiến độ.

## Các bước (cố định, theo thứ tự)
| # | Bước | Điều kiện để được "Gửi duyệt" |
|---|------|------------------------------|
| 0 | Thông tin dự án | Đủ trường bắt buộc (dưới đây) |
| 1–8 | QC Bản vẽ KT → Shop → Mua hàng → Gia công → Lắp dựng → Lợp tôn → HS nghiệm thu → HS quyết toán | Mọi mục QC của giai đoạn là Đạt hoặc Không áp dụng |

Trường bắt buộc của bước 0: CĐT, địa điểm, khu vực, K/L/H, diện tích, giá trị HĐ, màu sơn,
màu tôn mái, màu tôn vách, ≥ 1 người liên hệ, ≥ 1 dòng quy cách vật tư.
Giai đoạn chưa có mục QC nào thì bước đó **tự bỏ qua**.

## Trạng thái một bước
`CHUA_MO` → `DANG_LAM` → `CHO_DUYET` → `DA_DUYET`
                              ↘ `TRA_LAI` → (sửa) → `CHO_DUYET`

- Bước mở (`DANG_LAM`) khi bước trước `DA_DUYET`. Bước 0 mở ngay khi tạo dự án.
- **Khoá**: bước chưa mở thì không gửi duyệt được. Vẫn cho đánh giá mục QC sớm (thực tế
  nhiều việc chạy song song); chỉ có việc *chốt* bước là phải theo thứ tự.
- Đã duyệt mà sau đó có mục QC bị đánh lại "Không đạt" → bước tự về `DANG_LAM`, báo lại.

## Vai trò
- **Người phụ trách** (1 người / bước): làm và bấm *Gửi duyệt*. Mặc định: bước 0 = Kinh doanh,
  bước QC = bộ phận có nhiều mục nhất trong giai đoạn đó; người có quyền sửa dự án đổi được.
- **Người duyệt**: Ban giám đốc / Quản lý (ADMIN). *Duyệt* hoặc *Trả lại* (bắt buộc lý do).
- **Hạn xử lý**: mặc định lấy ngày kế hoạch của mốc tiến độ cùng giai đoạn; sửa tay được.

## Thông báo (dùng lại Trao đổi — chuông + hộp thư sẵn có)
- Gửi duyệt → tin `XIN_DUYET` tới các ADMIN.
- Trả lại → tin `CAN_SUA` (kèm lý do) tới người phụ trách.
- Duyệt → tin `DONG_Y` tới người phụ trách + người phụ trách bước kế tiếp ("đến lượt bạn").
- Giao người phụ trách → tin tới người được giao.

## Cảnh báo (cờ sức khoẻ dự án, không chặn)
- Bước quá hạn mà chưa duyệt.
- Bước bị trả lại.
- Giai đoạn tiến độ đã đánh "xong" mà bước QC tương ứng chưa duyệt.

## Giao diện
- Trang dự án: tab **Quy trình**, thanh bước ngang (trạng thái, người, hạn). Bấm một bước sẽ mở
  nội dung bước: form thông tin (bước 0) hoặc danh mục QC của giai đoạn (dùng lại QcPanel),
  cùng các nút Gửi duyệt / Duyệt / Trả lại và lịch sử trao đổi.
- Trang mới **Việc quy trình** (`/quy-trinh`): bước tôi phụ trách, bước chờ tôi duyệt, quá hạn. Trang Việc QC (từng mục) giữ nguyên.
- Tổng quan dự án: cột "Đang ở bước" + cờ.

## Dữ liệu
```
BuocQuyTrinh { id, projectId, buoc (THONG_TIN|BV_KT|…|HS_QT), trangThai,
               phuTrachId?, hanXuLy?, guiLuc?, duyetLuc?, nguoiDuyetId?,
               @@unique([projectId, buoc]) }
```
Lịch sử gửi/duyệt/trả lại nằm trong TraoDoi (`doiTuong = "BUOC"`), cùng AuditLog.
Dự án đang có: tạo bước khi mở trang lần đầu, trạng thái suy ra từ dữ liệu hiện tại
(đủ thông tin thì bước 0 = `DANG_LAM`, chưa tự duyệt gì).

## Chia đợt
1. Model + luật chuyển trạng thái (thuần, có test) + server action Gửi / Duyệt / Trả lại / Giao.
2. Tab Quy trình trên trang dự án + thông báo qua Trao đổi.
3. Trang Việc quy trình, cờ sức khoẻ, cột ở Tổng quan.
