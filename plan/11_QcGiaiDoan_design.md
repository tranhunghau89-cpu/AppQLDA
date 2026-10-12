# QC theo giai đoạn — Spec thiết kế

Ngày: 2026-10-12 · Trạng thái: chờ duyệt
Phần 2/2 (phần 1: `plan/10_BangThongTinDuAn_design.md`, đã làm).

## Mục đích

Kiểm soát chất lượng từng giai đoạn của dự án bằng **danh mục kiểm tra**, mỗi mục **giao cho
một bộ phận**: hồ sơ đã đủ chưa, bản vẽ đúng thông tin chưa, vật liệu đơn hàng đúng hợp đồng
chưa… QC **chỉ cảnh báo**, không chặn chuyển giai đoạn.

Thành công khi:
- Mỗi bộ phận mở một trang là thấy việc QC của mình ở mọi dự án được giao.
- Ban giám đốc thấy dự án có QC không đạt / chậm kiểm ngay trên trang Tổng quan dự án (cờ).
- Mọi lần đánh kết quả đều có người, thời điểm, ghi chú, bằng chứng và lịch sử.

## Khái niệm

- **Giai đoạn** = 8 mốc `MILESTONE_TYPE` hiện có: `BV_KT, SHOP, MUA_HANG, GIA_CONG, LAP_DUNG,
  LOP_TON, HS_NT, HS_QT`.
- **Bộ phận** = vai trò hiện có (`ROLES` trong `src/lib/rbac.ts`): `ADMIN` (Ban giám đốc),
  `SALES` (Kinh doanh), `ENGINEERING` (Kỹ thuật), `PROCUREMENT` (Vật tư), `ACCOUNTING` (Kế toán).
- **Kết quả**: `CHUA` (chưa kiểm) · `DAT` · `KHONG_DAT` · `KHONG_AP_DUNG`.

## Phạm vi

### 1. Bộ mẫu QC — trang `/qc-mau` (chỉ ADMIN sửa)

- Danh sách mục mẫu nhóm theo giai đoạn. Mỗi mục: nội dung, bộ phận, loại (`THUONG` hoặc
  `DOI_CHIEU_VAT_TU`), thứ tự, bật/tắt.
- Thêm / sửa / tắt / sắp thứ tự. Không xoá cứng (tắt để ẩn khỏi dự án mới).
- Lần chạy migration nạp **bộ gợi ý** (mục "Bộ mẫu gợi ý" bên dưới).

### 2. QC của dự án — khối "QC theo giai đoạn" trong `/projects/[id]`

- **Khởi tạo**: lần đầu khối hiện ra với dự án chưa có mục QC → nút "Tạo danh mục QC từ mẫu"
  (người có quyền `project/edit`). Chép các mục mẫu đang bật. Từ đó mẫu và dự án độc lập.
- **Thêm / sửa nội dung / xoá mục riêng** của dự án: người có quyền `project/edit`. Xoá mục đã
  có lần kiểm → hỏi xác nhận; lịch sử bị xoá theo.
- **Hiển thị**: một thẻ / giai đoạn theo thứ tự 8 mốc, đầu thẻ ghi "đạt x/n" (n không tính
  `KHONG_AP_DUNG`) và màu theo cờ QC của giai đoạn. Mỗi mục hiện: nội dung, badge bộ phận,
  kết quả hiện tại, người kiểm + thời điểm, ghi chú, ảnh/file, nút "Lịch sử (k)".
- **Đánh kết quả**: chọn kết quả + ghi chú + đính kèm (tuỳ chọn).
  - Được đánh khi: vai của người dùng **bằng** bộ phận của mục, hoặc là `ADMIN`; **và** người
    dùng xem được dự án (`requireProjectView`).
  - `KHONG_DAT` bắt buộc ghi chú (không rỗng sau trim).
  - Mỗi lần đánh tạo một bản ghi lịch sử; kết quả hiện tại của mục = lần mới nhất.
  - Không ghi nhật ký `AuditLog` riêng — lịch sử QC đã là nhật ký.
- **Bằng chứng**: ảnh hoặc PDF, tối đa 5 tệp / lần đánh, ≤ 10 MB / tệp; lưu bằng
  `uploadFile` (`src/lib/storage.ts`), xem bằng `signedUrl`. Kho chưa cấu hình
  (`isStorageConfigured() = false`) → ẩn ô đính kèm, vẫn đánh kết quả được.
- **Mục loại `DOI_CHIEU_VAT_TU`**: cạnh mục có nút "So sánh", mở bảng hai cột:
  - Trái: màu sơn, màu tôn mái, màu tôn vách, ghi chú vật tư và chủng loại theo HĐ
    (`ProjectMaterialSpec`) của dự án.
  - Phải: các dòng `PurchaseOrderItem` của mọi đơn mua của dự án, nhóm theo đơn
    (nhóm, NCC, tên, quy cách/ghi chú, khối lượng). Không hiện đơn giá/thành tiền.
  - Chỉ để người kiểm đối chiếu bằng mắt; app không tự kết luận.

### 3. Việc QC của tôi — trang `/qc`

- Liệt kê mục QC có kết quả `CHUA` hoặc `KHONG_DAT` mà người dùng **được đánh** (bộ phận của
  mình; `ADMIN` thấy mọi bộ phận), thuộc dự án người dùng xem được (`scopedProjectWhere`) và
  đang chạy (`status != HOAN_THANH`).
- Cột: dự án, giai đoạn, nội dung, bộ phận, kết quả, hạn (= `planDate` của mốc cùng giai
  đoạn), ghi chú gần nhất. Sắp: `KHONG_DAT` trước, rồi theo hạn tăng dần (không hạn ở cuối).
- Lọc: dự án, giai đoạn, kết quả. `ADMIN` có thêm lọc bộ phận.
- Bấm dòng → `/projects/[id]#qc`.
- Mục menu "Việc QC" dưới nhóm "Thi công" (không kèm số đếm).

### 4. Cờ QC trong bảng thông tin dự án (nối vào `tinhCo`)

| Cờ | Điều kiện (theo từng giai đoạn) | Lý do (ví dụ) |
|---|---|---|
| ĐỎ | có ≥ 1 mục `KHONG_DAT` | "QC Gia công: 1 mục không đạt" |
| VÀNG | có ≥ 1 mục `CHUA`, và mốc cùng giai đoạn chưa `done`, có `planDate` ≤ hôm nay + 7 (kể cả đã quá hạn) | "QC Lắp dựng còn 3 mục chưa kiểm" |

- Mục `KHONG_AP_DUNG` không tính. Dự án chưa tạo danh mục QC → không có cờ QC.
- `loai` mới của `LyDo`: `"QC"`. Thứ tự sắp như hiện tại (ĐỎ trước; trong ĐỎ theo `soNgay`
  giảm dần — cờ QC dùng `soNgay = số mục`).
- Lý do QC **không** ẩn với vai không xem tiền (không chứa tiền).
- Trang `/projects/tong-quan` và dải cờ dự án hiển thị chúng như các lý do khác.

## Bộ mẫu gợi ý (nạp lúc migration)

Ký hiệu bộ phận: KT = ENGINEERING, VT = PROCUREMENT, KD = SALES, KTo = ACCOUNTING, BGĐ = ADMIN.
Mục có (*) là loại `DOI_CHIEU_VAT_TU`.

**BV_KT — Bản vẽ kỹ thuật**
1. Hồ sơ thiết kế đủ: mặt bằng, mặt đứng, mặt cắt, kết cấu móng, khung — KT
2. Kích thước K × L × H và diện tích khớp hợp đồng — KT
3. Tải trọng, vùng gió, tiêu chuẩn thiết kế ghi rõ trên bản vẽ — KT
4. Bản vẽ kỹ thuật đã gửi CĐT và có xác nhận — KD

**SHOP — Shop drawing**
5. Shop drawing đúng thông tin HĐ: khẩu độ, bước khung, cao độ, độ dốc mái — KT
6. Chủng loại thép, tôn, xà gồ trên shop đúng chủng loại HĐ (*) — KT
7. Bảng thống kê vật tư (BOQ) từ shop khớp dự toán — KT
8. CĐT đã duyệt shop drawing (có biên bản / email xác nhận) — KD

**MUA_HANG — Mua hàng**
9. Vật liệu trong đơn hàng đúng chủng loại theo HĐ (*) — VT
10. Màu tôn, màu sơn trong đơn hàng đúng HĐ (*) — VT
11. Khối lượng đặt hàng khớp BOQ shop (sai lệch hợp lý) — VT
12. Đơn giá / NCC đã được duyệt — BGĐ

**GIA_CONG — Gia công**
13. Vật tư nhập kho đúng quy cách, có CO/CQ — VT
14. Kích thước cấu kiện đúng shop drawing (kiểm xác suất) — KT
15. Mối hàn đạt yêu cầu (chiều cao, không rỗ, không nứt) — KT
16. Sơn đúng màu, đủ số lớp và độ dày — KT

**LAP_DUNG — Lắp dựng**
17. Biên bản bàn giao mặt bằng, tim mốc, cao độ móng — KT
18. Kế hoạch an toàn lao động, thiết bị nâng có kiểm định — KT
19. Độ thẳng đứng cột, độ võng kèo trong dung sai — KT
20. Bu lông liên kết đủ số lượng, siết đúng lực — KT

**LOP_TON — Lợp tôn**
21. Tôn đúng loại, độ dày, màu theo HĐ (*) — KT
22. Vít, diềm, máng xối, phụ kiện lắp đủ và đúng vị trí — KT
23. Kiểm tra dột / thấm sau lợp — KT

**HS_NT — Hồ sơ nghiệm thu**
24. Đủ biên bản nghiệm thu từng giai đoạn — KT
25. Nhật ký thi công đầy đủ — KT
26. Bản vẽ hoàn công — KT
27. CO/CQ vật tư chính đầy đủ trong hồ sơ — VT

**HS_QT — Hồ sơ quyết toán**
28. Bảng khối lượng quyết toán khớp hoàn công — KT
29. Hồ sơ thanh toán các đợt đầy đủ — KTo
30. Đối chiếu công nợ với CĐT đã ký — KTo

## Dữ liệu

```prisma
model QcMau {
  id        String   @id @default(cuid())
  giaiDoan  String   // MILESTONE_TYPE
  noiDung   String
  boPhan    String   // Role
  loai      String   @default("THUONG") // THUONG | DOI_CHIEU_VAT_TU
  thuTu     Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([giaiDoan, thuTu])
}

model QcMuc {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  giaiDoan    String
  noiDung     String
  boPhan      String
  loai        String    @default("THUONG")
  thuTu       Int       @default(0)
  // Kết quả hiện tại = lần kiểm mới nhất (giữ sẵn để lọc/đếm không phải join lịch sử).
  ketQua      String    @default("CHUA") // CHUA | DAT | KHONG_DAT | KHONG_AP_DUNG
  nguoiKiem   String?   // tên người kiểm lần mới nhất
  ngayKiem    DateTime?
  ghiChu      String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  lanKiem     QcLanKiem[]
  @@index([projectId, giaiDoan])
  @@index([boPhan, ketQua])
}

model QcLanKiem {
  id         String   @id @default(cuid())
  mucId      String
  muc        QcMuc    @relation(fields: [mucId], references: [id], onDelete: Cascade)
  ketQua     String
  ghiChu     String?
  nguoiId    String
  nguoiTen   String
  nguoiVai   String
  createdAt  DateTime @default(now())
  tep        QcTep[]
  @@index([mucId, createdAt])
}

model QcTep {
  id        String    @id @default(cuid())
  lanKiemId String
  lanKiem   QcLanKiem @relation(fields: [lanKiemId], references: [id], onDelete: Cascade)
  key       String    // đường dẫn trong bucket
  ten       String    // tên tệp gốc
  mime      String
  createdAt DateTime  @default(now())
}
```

`Project` thêm quan hệ `qcMuc QcMuc[]`. Bộ mẫu gợi ý nạp bằng `INSERT` trong chính migration
(id cố định dạng `qcmau_01`…`qcmau_30` để chạy lại không trùng).

Xoá một `QcMuc` xoá theo lịch sử và bản ghi tệp (cascade); tệp trong bucket **không** xoá
(giống cách ảnh nhật ký đang làm) — chấp nhận rác lưu trữ.

## Quyền

| Việc | Ai |
|---|---|
| Xem QC của dự án | ai xem được dự án |
| Sửa bộ mẫu `/qc-mau` | `ADMIN` |
| Tạo danh mục từ mẫu, thêm/sửa/xoá mục của dự án | `can(role, "project", "edit")` + `denyProject` |
| Đánh kết quả một mục | (`role === muc.boPhan` hoặc `ADMIN`) + xem được dự án |
| Xem bảng so sánh vật tư | ai xem được dự án (không có giá) |

Kiểm quyền ở **server action** (UI chỉ ẩn nút). Hàm thuần `duocDanhQc(role, boPhan)` dùng
chung server + client.

## Cấu trúc mã

- `src/lib/qc.ts` (+test) — hàm thuần: `duocDanhQc`, `tomTatGiaiDoan(muc[])` → đếm đạt/tổng,
  `lyDoQc(muc[], milestones, nowMs)` → `LyDo[]`, `sapXepViecQc`, `kiemTraDanhGia(input)`
  (bắt buộc ghi chú khi `KHONG_DAT`, kết quả hợp lệ).
- `src/lib/constants.ts` — `QC_KET_QUA`, `QC_LOAI` (+ `_MAP`).
- `src/lib/projectHealth.ts` — `HealthInput` thêm `qc?: {giaiDoan, ketQua}[]`; `tinhCo` gọi
  `lyDoQc`. `loai` thêm `"QC"`.
- `src/app/(app)/qc-mau/` — trang + actions bộ mẫu.
- `src/app/(app)/projects/[id]/QcPanel.tsx`, `QcSoSanhVatTu.tsx`, `qcActions.ts`.
- `src/app/(app)/qc/` — trang Việc QC.
- `src/components/layout/Sidebar.tsx` — mục "Việc QC" và "Mẫu QC" (ADMIN).

## Kiểm thử

- Unit test `qc.ts`: quyền đánh theo vai, đếm bỏ `KHONG_AP_DUNG`, cờ ĐỎ/VÀNG QC (biên 7/8
  ngày, mốc đã xong không VÀNG, không `planDate` không VÀNG, chưa có danh mục không cờ),
  sắp xếp việc, `KHONG_DAT` thiếu ghi chú bị từ chối.
- Test `tinhCo` với dữ liệu QC (ĐỎ QC đứng cùng các ĐỎ khác).
- Chạy thử bản production + PGlite: tạo danh mục từ mẫu, đánh Đạt/Không đạt bằng vai đúng và
  sai bộ phận, đính kèm (nếu có kho), bảng so sánh, trang `/qc`, cờ trên trang tổng quan.

## Ngoài phạm vi

- Chặn chuyển giai đoạn khi QC chưa đạt (đã chốt: chỉ cảnh báo).
- App tự dò sai lệch vật tư (đã chốt: người kiểm đối chiếu bằng mắt).
- Số đếm trên menu, thông báo / email khi có mục mới hay không đạt.
- Giao QC cho **người cụ thể** (chỉ giao theo bộ phận).
- Xoá tệp khỏi bucket khi xoá mục.
