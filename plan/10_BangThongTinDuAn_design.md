# Bảng thông tin dự án — Spec thiết kế

Ngày: 2026-10-12 · Trạng thái: chờ duyệt
Phần 1/2 (phần 2: QC theo giai đoạn — spec riêng, làm sau).

## Mục đích

Cho ban giám đốc / quản lý **nắm nhanh tình hình** các công trình đang chạy: dự án nào chậm
tiến độ, chậm thu tiền, vật tư trễ — và xem sâu một dự án trên một trang. Chủ yếu là
**xem**; chỉ nhập ít dữ liệu mới (người liên hệ, chủng loại vật tư, màu sơn/tôn).

Thành công khi: mở một trang là thấy ngay danh sách dự án có cờ đỏ/vàng kèm lý do, bấm vào
thấy đủ CĐT, liên hệ, tiến độ, thanh toán, vật tư của dự án đó.

## Phạm vi

### 1. Trang tổng hợp `/projects/tong-quan`

- Một dòng / dự án có `status != HOAN_THANH`.
- Cột: mã + tên dự án, CĐT, giai đoạn hiện tại (`status`), % tiến độ, % đã thu, giá trị HĐ,
  còn phải thu, cờ + lý do ngắn.
- Mặc định sắp xếp: ĐỎ → VÀNG → không cờ; trong cùng nhóm theo mã dự án.
- Lọc: theo cờ (tất cả / đỏ / vàng / có cờ), theo `status`.
- Bấm dòng → `/projects/[id]?tab=tong-quan`.
- Áp dụng phân quyền xem dự án hiện có (chỉ thấy dự án người dùng được xem).

### 2. Tab "Tổng quan" trong `/projects/[id]`

Là tab mặc định đầu tiên của trang chi tiết dự án. Bốn khối:

**a. Chủ đầu tư & người liên hệ**
- Thông tin `Customer` (tên, địa chỉ, người liên hệ, SĐT) — chỉ hiển thị, sửa ở trang CĐT.
- Danh sách `ProjectContact`: thêm / sửa / xoá tại chỗ.

**b. Tiến độ thi công**
- Dòng thời gian 8 mốc `Milestone` theo thứ tự `BV_KT → SHOP → MUA_HANG → GIA_CONG →
  LAP_DUNG → LOP_TON → HS_NT → HS_QT`; mỗi mốc hiện ngày KH, ngày TT, trạng thái.
- Tô màu: đỏ = quá hạn, vàng = sắp đến hạn (≤ 7 ngày), xanh = xong, xám = chưa có ngày.
- Mốc chưa tạo bản ghi vẫn hiện (xám) để thấy đủ 8 bước.

**c. Tiến độ thanh toán**
- Bảng các đợt `Payment` chiều `THU`: tên đợt, hạn, kế hoạch, thực thu, còn lại, trạng thái
  (đủ / thiếu / quá hạn / sắp đến hạn).
- Dòng tổng: Σ kế hoạch, Σ thực thu, % đã thu.
- Tóm tắt chiều `CHI`: Σ phải trả, Σ đã trả, số đợt quá hạn.

**d. Vật tư**
- Đầu khối: **màu sơn kết cấu**, **màu tôn mái**, **màu tôn vách**, **ghi chú vật tư** — sửa
  tại chỗ.
- Bảng chủng loại theo hợp đồng `ProjectMaterialSpec` (nhóm, tên, thông số, xuất xứ): thêm /
  sửa / xoá / sắp thứ tự; nút **"Lấy từ báo giá"**.
- Tóm tắt đơn mua `PurchaseOrder` theo `category` (KCT / XA_GO / TON / VTP): NCC, Σ giá trị,
  Σ kg, trạng thái, ngày giao dự kiến / thực tế; đơn trễ tô đỏ.

## Quy tắc cờ

`hôm nay` tính theo giờ Việt Nam (đầu ngày). `N = 7` ngày.

| Cờ | Điều kiện | Lý do hiển thị (ví dụ) |
|---|---|---|
| ĐỎ — chậm tiến độ | Milestone `done = false`, có `planDate < hôm nay` | "Quá hạn Lắp dựng 5 ngày" |
| ĐỎ — chậm thu | Payment `THU`, `dueDate < hôm nay`, `paidAmount < amount` (null = 0) | "Quá hạn thu Đợt 2: 120 tr" |
| ĐỎ — vật tư trễ | PurchaseOrder `status != RECEIVED`, `expectedDate < hôm nay` | "Trễ giao Tôn 3 ngày" |
| VÀNG — sắp đến hạn | Milestone chưa xong hoặc Payment THU chưa đủ, có hạn trong `[hôm nay, hôm nay + N]` | "Lắp dựng còn 4 ngày" |

- Cờ của dự án = mức cao nhất trong các lý do; trang tổng hợp hiện lý do nặng nhất + "(+k)".
- Thiếu ngày (null) → không sinh cờ.
- Cờ **tính lúc tải trang**, không lưu CSDL.
- Phần 2 sẽ thêm lý do "QC chưa đạt" vào cùng cơ chế.

## Chỉ số

- **% tiến độ** = số mốc `done` / 8.
- **% đã thu** = Σ `paidAmount` THU / Σ `amount` THU (Σ kế hoạch = 0 → hiện "—").
- **Giá trị HĐ** = `valueWithVat` của HĐ `SIGNED` mới nhất; không có → `Project.salePrice`.
- **Còn phải thu** = Σ `amount` THU − Σ `paidAmount` THU.

## Thay đổi dữ liệu

```prisma
model ProjectContact {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  role      String?  // CDT | KY_THUAT | GIAM_SAT | KE_TOAN | KHAC
  phone     String?
  email     String?
  note      String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([projectId])
}

model ProjectMaterialSpec {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tag       String?  // nhóm vật tư (cùng bộ giá trị VAT_TU_TAG của ClientQuoteSpec)
  name      String   // "Thép tấm tổ hợp"
  spec      String?  // "fy = 2.450 kG/cm2"
  origin    String?  // xuất xứ / ghi chú
  sortOrder Int      @default(0)
  @@index([projectId])
}
```

Thêm vào `Project`: `mauSon String?`, `mauTonMai String?`, `mauTonVach String?`,
`ghiChuVatTu String?`, cùng hai quan hệ `contacts ProjectContact[]`,
`materialSpecs ProjectMaterialSpec[]`. Không sửa bảng nào khác.

**Vì sao lưu chủng loại riêng thay vì đọc thẳng báo giá:** khi ký HĐ chủng loại hay đổi
(độ dày tôn, mác thép…); QC phần 2 đối chiếu đơn mua với bảng này nên nó phải sửa được.

**"Lấy từ báo giá":** nguồn = `ClientQuote` của dự án đã chốt (mới nhất nếu nhiều), chép các
`ClientQuoteSpec` có `an = false`. Nếu bảng đã có dòng → hỏi xác nhận rồi **thay toàn bộ**.
Không có báo giá → nút bị vô hiệu kèm chú thích.

## Cấu trúc mã

- `src/lib/projectHealth.ts` — hàm thuần: `tinhCoDuAn(duLieu, homNay)` → `{ muc, lyDo[] }`,
  `tinhChiSo(duLieu)` → `{ tienDo, daThu, giaTriHD, conPhaiThu }`. Không đụng CSDL.
- `src/lib/projectHealth.test.ts` — vitest.
- `src/app/(app)/projects/tong-quan/` — trang tổng hợp (server component, một truy vấn gom
  milestones / payments THU / purchaseOrders / contracts cho mọi dự án đang chạy).
- `src/app/(app)/projects/[id]/` — `Overview.tsx` (tab) + `ProjectContacts.tsx`,
  `MaterialInfo.tsx`, server actions `overviewActions.ts` (có ghi `AuditLog` như các action
  hiện có).
- Theo mẫu sẵn có của `Milestones.tsx`, `Payments.tsx` cho giao diện và action.

## Kiểm thử

- Unit test `projectHealth`: quá hạn từng loại, sắp đến hạn biên 0 / 7 / 8 ngày, đã xong,
  thu đủ, thiếu ngày, chiều CHI không sinh cờ, Σ kế hoạch = 0, chọn giá trị HĐ.
- Test "Lấy từ báo giá": bỏ dòng `an`, thay toàn bộ.
- Kiểm tra giao diện trên bản build production cục bộ (PGlite).

## Ngoài phạm vi

- QC theo giai đoạn (phần 2).
- Thông báo / email cảnh báo.
- Sửa ngưỡng N trong giao diện (cố định 7).
- Danh sách người liên hệ dùng chung theo CĐT.
