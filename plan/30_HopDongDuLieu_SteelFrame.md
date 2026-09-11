# Hợp đồng dữ liệu: SteelFrame VN → QLDA (báo giá)

Phiên bản 1 · 11/09/2026 · trạng thái: **đề xuất, chờ chốt hai bên**

Hai ứng dụng:

| | SteelFrame VN | QLDA |
|---|---|---|
| Nguồn | `D:\NCN` | `D:\...\AppQLDA\qlda-web` |
| Chạy tại | `https://www.bca-bim.com/steel-frame` | (nội bộ) |
| Kiểu | SPA Vite + React, **thuần client**, không backend | Next.js + Postgres |
| Vai trò ở đây | **bên tạo** khối lượng | **bên tiêu thụ**, rót vào dòng báo giá |

SteelFrame tính diện tích và khối lượng theo từng hạng mục; QLDA đọc các con số đó
và rót thẳng vào cột **Tổng khối lượng** của bảng báo giá gửi khách.

---

## 1. Vì sao cần một hợp đồng riêng, không dùng thẳng file `.json` của SteelFrame

SteelFrame đã xuất được `<mã>.json` = `{ schemaVersion: "3.0.0", project: {...} }`
(`src/domain/schema.ts`). Nhưng đó là **tham số mô hình** (nhịp, bước cột, độ dốc,
tiết diện…), không phải khối lượng. Muốn ra khối lượng thì bên nhận phải chạy lại
cả `generateGraph` → `buildViewModel` → `computeBom` — tức là phải mang theo ~70.000
dòng code của SteelFrame.

Nên: **SteelFrame tính xong rồi mới xuất**, và xuất ra một file phẳng, nhỏ, chỉ gồm
kết quả. QLDA không cần biết gì về hình học.

---

## 2. Định dạng

Tên file đề xuất: `<mã dự án>-khoiluong.json`

```json
{
  "version": 1,
  "generatedAt": "2026-09-11T02:00:00.000Z",
  "source": "steelframe-vn@0.1.0",
  "modelSchemaVersion": "3.0.0",

  "duAn": {
    "ma": "SF-260812",
    "ten": "Nhà xưởng Hồng Ngự",
    "chuDauTu": "Công ty CP ABC",
    "diaDiem": "Hồng Ngự, Đồng Tháp"
  },

  "hinhHoc": {
    "nhip": 25.0,
    "buocCot": 6.0,
    "soBuoc": 20,
    "chieuDaiNha": 120.0,
    "chieuCaoDiemMai": 7.5,
    "doDocMaiPhanTram": 10.0
  },

  "hangMuc": [
    { "key": "SAN_XAY_DUNG",     "ten": "Diện tích sàn xây dựng", "donVi": "m2", "khoiLuong": 3000.0 },
    { "key": "MAI",              "ten": "Mái",                    "donVi": "m2", "khoiLuong": 3015.0 },
    { "key": "VACH",             "ten": "Vách / thưng dọc nhà",   "donVi": "m2", "khoiLuong": 1800.0 },
    { "key": "DAU_HOI",          "ten": "Đầu hồi",                "donVi": "m2", "khoiLuong": 312.5 },
    { "key": "CUA_TROI",         "ten": "Cửa trời",               "donVi": "m2", "khoiLuong": 210.0 },
    { "key": "MAI_HIEN",         "ten": "Mái hiên",               "donVi": "m2", "khoiLuong": 246.0 },
    { "key": "SAN_LUNG",         "ten": "Sàn lửng",               "donVi": "m2", "khoiLuong": 0.0 },
    { "key": "THEP_KHUNG_CHINH", "ten": "Thép khung chính",       "donVi": "kg", "khoiLuong": 62400.0 },
    { "key": "THEP_PHU",         "ten": "Xà gồ, giằng, phụ kiện", "donVi": "kg", "khoiLuong": 16100.0 },
    { "key": "THEP_TONG",        "ten": "Tổng thép (mua hàng)",   "donVi": "kg", "khoiLuong": 86500.0 },
    { "key": "SON",              "ten": "Diện tích sơn",          "donVi": "m2", "khoiLuong": 2100.0 }
  ],

  "canhBao": []
}
```

### Quy tắc

1. **`version`** là phiên bản của *hợp đồng này*, không phải của mô hình. Hiện tại `1`.
   QLDA từ chối file có `version` khác 1 kèm thông báo rõ ràng.
   `modelSchemaVersion` chỉ để ghi vết, QLDA không đọc để quyết định gì.
2. **`hangMuc[].key`** là khóa máy đọc, bảng ở §3. Key lạ thì QLDA **bỏ qua, không
   báo lỗi** — SteelFrame thêm hạng mục mới không được làm vỡ bản QLDA cũ.
3. **`ten`** là nhãn người đọc, QLDA chỉ dùng để hiển thị trong bảng xem trước.
   Đổi `ten` không ảnh hưởng gì; đổi `key` là **breaking change**, phải tăng `version`.
4. **`donVi`** chỉ nhận `"m2"` hoặc `"kg"`. QLDA đối chiếu với đơn vị của dòng báo
   giá và cảnh báo nếu lệch (rót `kg` vào dòng `m2` gần như chắc chắn là nhầm).
5. **`khoiLuong`** là số, không âm, **không làm tròn** — QLDA tự làm tròn khi hiển thị.
   Hạng mục không có trong mô hình thì xuất `0`, hoặc bỏ hẳn khỏi mảng; cả hai đều
   được, QLDA coi như nhau.
6. **`canhBao`** là mảng chuỗi tiếng Việt, hiện nguyên văn cho người dùng (ví dụ
   `"Chiều cao H vượt phạm vi đã kiểm định"`). Mảng rỗng nếu không có gì.
7. Trường lạ ở bất kỳ cấp nào đều **được phép** và bị bỏ qua — để SteelFrame thêm
   thông tin mà không cần QLDA phát hành bản mới.

---

## 3. Bảng khóa hạng mục (`key`)

Đây là phần cần chốt kỹ nhất — nó là giao diện thật giữa hai bên.

| key | đơn vị | nghĩa |
|---|---|---|
| `SAN_XAY_DUNG` | m2 | Diện tích sàn xây dựng = nhịp × chiều dài nhà. **Đây là mẫu số của đơn giá m²** trong báo giá. |
| `MAI` | m2 | Diện tích mái theo mặt nghiêng (đã nhân hệ số dốc), **chưa gồm** cửa trời và mái hiên. |
| `VACH` | m2 | Tôn thưng hai mặt dọc nhà = 2 × chiều dài × chiều cao diềm mái. |
| `DAU_HOI` | m2 | Hai đầu hồi, gồm cả phần tam giác trên diềm mái. |
| `CUA_TROI` | m2 | Toàn bộ diện tích bao che của cửa trời (mái + vách cửa trời). `0` nếu không có. |
| `MAI_HIEN` | m2 | Mái hiên / canopy, theo mặt nghiêng. `0` nếu không có. |
| `SAN_LUNG` | m2 | Sàn lửng (mezzanine). `0` nếu không có. |
| `THEP_KHUNG_CHINH` | kg | Cột, kèo, cột giữa, cột hồi, cột gió — thép chính. |
| `THEP_PHU` | kg | Xà gồ, giằng, ty giằng, chống xà gồ, thanh chống diềm. |
| `THEP_TONG` | kg | **Khối lượng mua hàng** — `BomTotals.purchaseT × 1000`, đã gồm hao hụt và liên kết. Không phải tổng của hai dòng trên. |
| `SON` | m2 | Diện tích sơn thép (`BomTotals.paintM2`). Đây là diện tích **bề mặt thép**, không phải diện tích tôn — đừng nhầm với `MAI`/`VACH`. |

Chỗ đã có sẵn bên SteelFrame để lấy số:

- Hình học và diện tích bao che: `src/core/generator.ts` (`roofSpans`, `roofZ`,
  `ridgeHeight`), `src/core/axes.ts` (`buildingLength`, `hasUnevenBays`),
  `project.geometry`, `project.cuaTroi`, `project.canopy`, `project.mezzanine`.
  **Lưu ý `bayOffsets`**: khi bước cột không đều thì chiều dài nhà là phần tử cuối
  của `bayOffsets`, không phải `baySpacing × bayCount`.
- Khối lượng thép và diện tích sơn: `computeBom()` trong `src/core/bom.ts` →
  `BomTotals { theoreticalT, theoreticalOrderT, connectionT, fabricationT, purchaseT, paintM2 }`.
  Cắt theo `MemberRole` để tách khung chính / phụ (`src/core/types.ts`).

---

## 4. Đường truyền

### 4.1 Hôm nay — xuất file, QLDA nhập file (không cần backend)

SteelFrame thêm một nút cạnh các nút xuất sẵn có trong `src/ui/bottom/ExportTab.tsx`,
tải xuống `<mã>-khoiluong.json`. QLDA có modal "Nhập từ SteelFrame" để tải file đó lên,
hiện bảng xem trước rồi cho chọn rót vào dòng báo giá nào.

Chạy được ngay, không phụ thuộc hạ tầng, và là đường duy nhất hoạt động khi hai app
khác tên miền.

### 4.2 Về sau — QLDA tự đọc

Anh nhắc phương án "web báo giá tự đọc". Nó khả thi, nhưng cần thêm một trong hai:

- **Cùng origin**: nếu QLDA cũng chạy dưới `https://www.bca-bim.com`, thì QLDA đọc
  thẳng `localStorage["steelframe-vn:project"]` phía client được — cùng origin nên
  trình duyệt cho phép. Nhưng như §1 đã nói, localStorage chỉ chứa **tham số mô hình**,
  không chứa khối lượng. Nên SteelFrame vẫn phải ghi thêm một khóa, ví dụ
  `steelframe-vn:khoiluong`, đúng định dạng ở §2. Đây là thay đổi nhỏ nhất để có
  "tự đọc" — thêm một dòng ghi trong `src/state/storage.ts`.
- **Một endpoint đọc**: SteelFrame hiện không có backend nào cả (0 lời gọi `fetch`
  trong `src/`). Muốn QLDA gọi HTTP thì phải dựng thêm một dịch vụ lưu mô hình theo
  mã dự án. Việc này lớn hơn nhiều so với xuất file, và chỉ nên làm nếu đằng nào
  cũng cần lưu mô hình trên máy chủ.

**Đề nghị**: làm §4.1 trước. Nó cho kết quả dùng được ngay và định dạng ở §2 không
đổi khi sau này chuyển sang §4.2 — chỉ đổi chỗ lấy file, không đổi nội dung file.

---

## 5. Phía QLDA sẽ làm gì với dữ liệu này

- `src/lib/steelframe/contract.ts` — schema zod đúng theo §2, khoan dung với trường lạ.
- Cột `steelFrameKey String?` trên `QuoteTemplateLine` / `ClientQuoteLine`: một dòng
  mẫu tự khai "khối lượng của tôi lấy từ `MAI`", nên lần nhập sau chỉ cần một cú bấm.
- Modal xem trước: hiện bảng `key | tên | đơn vị | khối lượng | rót vào dòng nào`,
  người dùng xác nhận rồi mới ghi. Không bao giờ ghi đè im lặng.

---

## 6. Việc cần chốt

1. Bảng `key` ở §3 — đủ chưa, có hạng mục nào SteelFrame tính được mà thiếu ở đây không?
2. `THEP_TONG` lấy `purchaseT` (đã gồm hao hụt) hay `fabricationT` (chưa gồm)? Báo giá
   thường tính theo khối lượng mua hàng, nên đề xuất `purchaseT`.
3. `CUA_TROI` gộp cả mái và vách cửa trời vào một số, hay tách hai key?
