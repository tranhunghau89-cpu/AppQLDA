// Sơ đồ các bước của sổ tay — HTML tĩnh dựng từ dữ liệu dưới đây, không có dữ liệu người
// dùng nào đi vào. Mỗi sơ đồ gắn vào một danh sách bước (`<ol class="steps">`) trong
// noiDung.ts theo `khoa`: một đoạn chữ duy nhất nằm trong danh sách đó. Danh sách chữ chi
// tiết được gập lại ngay dưới sơ đồ, nên sửa lời hướng dẫn vẫn sửa ở noiDung.ts.
// Kiểu dáng: soTay.module.css (nhóm `.flow`).

type Phong = "bgd" | "kd" | "kt" | "vt" | "ke";

type Buoc =
  | string
  | {
      /** Tên bước (ngắn). */
      t: string;
      /** Dòng phụ: bấm gì, điền gì. */
      m?: string;
      /** xong = bước cuối (xanh lá); luu-y = chỗ dễ sai (vàng). */
      k?: "xong" | "luu-y";
      /** Rẽ nhánh: người dùng chọn một trong các việc này. */
      hoac?: { t: string; m?: string }[];
    };

type SoDo = { ten?: string; gon?: boolean; buoc: Buoc[] };

function nut(b: Buoc, i: number): string {
  const o = typeof b === "string" ? { t: b } : b;
  const lop = ["nd", o.k ?? ""].join(" ").trim();
  const phu = o.m ? `<span>${o.m}</span>` : "";
  const nhanh = o.hoac
    ? `<div class="or">${o.hoac
        .map((h) => `<div class="opt"><b>${h.t}</b>${h.m ? `<span>${h.m}</span>` : ""}</div>`)
        .join('<i>hoặc</i>')}</div>`
    : "";
  return `<li class="${lop}"><em>${i + 1}</em><div><b>${o.t}</b>${phu}${nhanh}</div></li>`;
}

function flow(s: SoDo): string {
  const ten = s.ten ? `<p class="flow-ten">${s.ten}</p>` : "";
  return `${ten}<ol class="flow${s.gon ? " gon" : ""}">${s.buoc.map(nut).join("")}</ol>`;
}

const d = (khoa: string, ...sodo: SoDo[]) => ({ khoa, sodo });
const b = (...buoc: Buoc[]): SoDo => ({ buoc });

const SO_DO = [
  // ---------- Chung ----------
  d(
    "Mở trình duyệt (Chrome",
    b(
      { t: "Mở trình duyệt", m: "Chrome, Edge, Cốc Cốc, Safari" },
      { t: "Vào địa chỉ app", m: "quản trị viên gửi" },
      { t: "Nhập email + mật khẩu", m: "quản trị viên cấp, bấm Đăng nhập" },
      { t: "Kiểm tra tên và vai trò", m: "góc trên bên phải. Sai thì báo quản trị viên sửa", k: "xong" },
    ),
  ),
  d(
    "Bấm vào ô số (khối lượng",
    b(
      { t: "Bấm vào ô số", m: "ô hiện khung xanh" },
      { t: "Gõ số hoặc công thức", m: "20.580 · 5,6 · =12*1000" },
      {
        t: "Kết thúc",
        hoac: [
          { t: "Enter / bấm ra ngoài", m: "lưu" },
          { t: "Esc", m: "bỏ, ô về số cũ" },
        ],
        k: "xong",
      },
    ),
  ),
  d(
    "Bấm vào tên công việc. Danh sách",
    b(
      { t: "Bấm vào tên công việc", m: "danh sách công tác của thư viện hiện ra" },
      {
        t: "Chọn cách làm",
        hoac: [
          { t: "Chỉ đổi tên", m: "sửa chữ, rồi Enter hoặc Tab" },
          { t: "Đổi công việc khác", m: "bấm công tác trong danh sách, hoặc xoá tên và gõ vài chữ để tìm" },
        ],
      },
      {
        t: "Dòng cập nhật",
        m: "đổi công việc thì lấy mã, đơn vị, đơn giá mới; khối lượng, nhóm, ghi chú giữ nguyên. Esc để thôi",
        k: "xong",
      },
    ),
  ),

  // ---------- Ban giám đốc ----------
  d(
    "Thêm người dùng</span>. Điền",
    b(
      { t: "Thêm người dùng", m: "điền Tên, Email, Số điện thoại" },
      { t: "Chọn Vai trò", m: "đúng phòng của người đó" },
      { t: "Đặt Mật khẩu", m: "tối thiểu 6 ký tự, lưu" },
      { t: "Gửi email + mật khẩu", m: "cho người đó", k: "xong" },
      {
        t: "Về sau",
        hoac: [
          { t: "Quên mật khẩu", m: "bút sửa, gõ Mật khẩu mới" },
          { t: "Nghỉ việc", m: "bỏ tích Tài khoản hoạt động. Không xoá" },
        ],
      },
    ),
  ),
  d(
    "Ở khung <b>Thành viên dự án</b>, chọn người",
    b(
      { t: "Mở Dự án", m: "bấm vào mã dự án" },
      { t: "Khung Thành viên dự án", m: "chọn người trong ô “Chọn người để gán”" },
      { t: "Bấm Gán", m: "gán đủ kỹ thuật, vật tư, kế toán phụ trách" },
      { t: "Người đó thấy dự án", m: "chưa gán thì họ không thấy", k: "luu-y" },
    ),
  ),
  d(
    "Mở <span class=\"path\">Khách hàng (CRM)</span>, bấm bút sửa ở dòng khách",
    b(
      { t: "Mở Khách hàng (CRM)" },
      { t: "Bấm bút sửa", m: "ở dòng khách" },
      { t: "Chọn Người phụ trách, lưu", m: "khách chưa phân công thì mọi nhân viên kinh doanh đều thấy", k: "xong" },
    ),
  ),
  d(
    "Thêm công tác</span>. Điền",
    b(
      { t: "Thêm công tác", m: "Mã theo nhóm (AA, AB, AC, AD…), Đơn vị, Nội dung đầy đủ" },
      { t: "Loại (rút gọn)", m: "tên ngắn trên dự toán thi công, ví dụ “Thép tổ hợp”" },
      { t: "Chọn Nhóm chi phí", m: "quyết định dòng rơi vào nhóm nào khi đổ xuống dự toán thi công", k: "xong" },
    ),
  ),
  d(
    "Bấm vào tên công tác để mở trang chi tiết",
    b(
      { t: "Mở chi tiết công tác", m: "xem Lịch sử đơn giá" },
      { t: "Thêm bản giá", m: "chọn Hiệu lực từ ngày" },
      { t: "Chọn phạm vi", m: "vật liệu và khu vực, hoặc để mọi vật liệu / toàn quốc" },
      { t: "Nhập giá", m: "VT, NC + Máy, HS — hoặc gõ thẳng Đơn giá trọn gói. Ghi nguồn" },
      { t: "Lưu bản giá", m: "thêm bản mới, không sửa đè bản cũ", k: "xong" },
    ),
  ),
  d(
    "Thêm bộ hạng mục</span>: <b>Mã</b>",
    b(
      { t: "Thêm bộ hạng mục", m: "Mã, Tên bộ, Loại công trình" },
      { t: "Thêm các phần", m: "A, B… kèm tên in cho khách" },
      { t: "Thêm dòng trong phần", m: "bấm ô mã để chọn công việc trong thư viện" },
      { t: "Điền Suất / m²", m: "để app gợi ý khối lượng khi áp bộ", k: "xong" },
    ),
  ),
  d(
    "Bấm bộ lọc <b>Chờ duyệt</b>",
    b(
      { t: "Lọc Chờ duyệt", m: "ở trang Phê duyệt" },
      { t: "Đọc đề xuất", m: "tiêu đề, số tiền, dự án, nội dung" },
      {
        t: "Quyết định",
        hoac: [
          { t: "Duyệt", m: "ghi chú có thể để trống" },
          { t: "Từ chối", m: "bắt buộc ghi lý do" },
        ],
        k: "xong",
      },
    ),
  ),

  // ---------- Kinh doanh ----------
  d(
    "Thêm khách</span>. Chỉ bắt buộc",
    b(
      { t: "Thêm khách", m: "chỉ bắt buộc Tên khách / công ty" },
      { t: "Điền thêm nếu có", m: "liên hệ, nguồn khách, người phụ trách" },
      { t: "Mở dòng khách", m: "bấm vào dòng để mở rộng" },
      { t: "Ghi nhật ký trao đổi", m: "mỗi lần gọi / gặp: Hình thức, Ngày, Nội dung, Hẹn liên hệ lại", k: "xong" },
    ),
  ),
  d(
    "Thêm công trình</span>. Điền",
    b(
      { t: "Thêm công trình", m: "tên, địa điểm, loại, diện tích, K, L, H" },
      { t: "Theo dõi Trạng thái", m: "Mới → Đang chào giá → Đang đàm phán" },
      {
        t: "Kết quả",
        hoac: [
          { t: "Tiếp tục chào", m: "Lập dự toán chi tiết hoặc Lập báo giá gửi khách" },
          { t: "Mất khách", m: "chọn Mất khách và ghi lý do" },
        ],
      },
    ),
  ),
  d(
    "Thêm báo giá</span>. Đặt tiêu đề",
    b(
      { t: "Thêm báo giá", m: "tiêu đề, hệ số TL, khu vực. Hoặc Tạo từ dự án khác" },
      { t: "Áp bộ hạng mục", m: "xem trước, nhập diện tích từng phần" },
      { t: "Nhập khối lượng", m: "ngay trên bảng. Dòng ∑ tự tính" },
      { t: "Kiểm tra giá", m: "Giá gốc và Đơn giá bán, sửa trực tiếp trên ô" },
      { t: "Thêm dòng / phần thiếu", m: "đổi tên hoặc thay công việc khi cần" },
      { t: "In / PDF", m: "huy hiệu vàng → bấm Cập nhật giá từ thư viện trước khi in", k: "xong" },
    ),
  ),
  d(
    "Cách nhanh nhất: trên thẻ dự toán chào giá",
    b(
      { t: "Tạo báo giá", m: "từ thẻ dự toán, chọn Mẫu báo giá. Hoặc Lập báo giá từ đầu" },
      { t: "Điền đầu báo giá", m: "số báo giá, ngày, Kính gửi" },
      { t: "Sửa hạng mục", m: "ngay trên bảng. Dòng khoán: chốt cứng thành tiền" },
      { t: "Xem Giá vốn", m: "nhãn lãi: đỏ = lỗ, vàng = dưới 10%" },
      { t: "Điều khoản & vật liệu", m: "VAT, hiệu lực, tiến độ, đợt thanh toán" },
      { t: "Xem trước, In / Lưu PDF", m: "gửi khách" },
      { t: "Cập nhật Trạng thái", m: "Nháp → Đã gửi → Đang đàm phán → Đã chốt (hoặc Hủy)", k: "xong" },
    ),
  ),
  d(
    "Bảo đảm công trình có ít nhất một báo giá",
    b(
      { t: "Có báo giá Đã chốt", m: "chưa có thì nút tạo dự án không hiện", k: "luu-y" },
      { t: "Bấm Đã ký hợp đồng — tạo dự án", m: "ở thẻ công trình trong CRM" },
      { t: "Chủ đầu tư", m: "chọn sẵn có, hoặc điền pháp nhân mới và địa chỉ theo giấy ĐKKD" },
      { t: "Dự án", m: "đặt Mã dự án (N0xx) và tên" },
      { t: "Xác nhận", m: "dự toán và báo giá đi theo sang dự án" },
      { t: "Báo Ban giám đốc gán thành viên", m: "kỹ thuật, vật tư, kế toán", k: "xong" },
    ),
  ),
  d(
    "Thêm hợp đồng</span>: số hợp đồng",
    b(
      { t: "Thêm hợp đồng", m: "số, ngày ký, Bên A, VAT, điều khoản thanh toán, file" },
      { t: "Đặt Trạng thái", m: "Báo giá → Đã ký → Thanh lý" },
      { t: "Thêm hạng mục", m: "tên, đơn vị, khối lượng, đơn giá. Thành tiền tự nhân" },
      { t: "Đẩy giá bán vào dự án", m: "từ báo giá đã chốt. Mọi báo cáo lãi lỗ dùng con số này", k: "xong" },
    ),
  ),
  d(
    "Trang dự án › khung <b>Hồ sơ & phiên bản</b>",
    b(
      { t: "Chọn loại", m: "Báo giá hoặc Hợp đồng" },
      { t: "Nhập phiên bản", m: "R0, R1…, ngày gửi, trạng thái" },
      { t: "Thêm phiên bản" },
      {
        t: "Khi gửi bản mới",
        hoac: [
          { t: "Bản cũ", m: "chuyển sang Bị thay thế" },
          { t: "Bản khách đồng ý", m: "đặt Được duyệt" },
        ],
        k: "xong",
      },
    ),
  ),

  // ---------- Kỹ thuật ----------
  d(
    "Dải trạng thái trên đầu trang",
    b(
      { t: "Chuyển Trạng thái", m: "Chờ → Shop → Gia công → Lắp dựng → Hoàn thành" },
      { t: "Khung Thông tin dự án", m: "vị trí, K×L×H, diện tích, ngày, người phụ trách" },
      { t: "Nhà cung cấp theo hạng mục", m: "BL neo, KCT, Xà gồ, BLLK, Tôn, đội lắp dựng", k: "xong" },
    ),
  ),
  d(
    "Tám mốc cố định",
    {
      ten: "Tám mốc cố định, đi lần lượt",
      gon: true,
      buoc: ["Bản vẽ KT", "Shop", "Mua hàng", "Gia công", "Lắp dựng", "Lợp tôn", "HS nghiệm thu", { t: "HS quyết toán", k: "xong" }],
    },
    {
      ten: "Với mỗi mốc",
      buoc: [
        { t: "Điền ngày Kế hoạch", m: "ngay khi có tiến độ tổng" },
        { t: "Khi xong, điền ngày Thực tế", m: "bắt buộc: thiếu ngày thì mốc không được đếm vào báo cáo", k: "luu-y" },
        { t: "Tích Xong, bấm Lưu", m: "ở dòng đó", k: "xong" },
      ],
    },
  ),
  d(
    "Ô tìm nhanh: gõ quy cách",
    b(
      { t: "Gõ quy cách", m: "I300, V50x5, Ø16, 40x80x1.4" },
      { t: "Đọc kết quả", m: "kg/m, tiết diện (cm²), kg/cây" },
      { t: "Máy tính nhanh", m: "bấm mã thép, nhập dài mỗi thanh × số thanh → kg" },
      { t: "Bóc khối lượng", m: "chọn dự án, thêm cấu kiện → BT (m³), ván khuôn (m²), thép (kg)", k: "xong" },
    ),
  ),

  // ---------- Vật tư ----------
  d(
    "Bấm <span class=\"ui\">Đổ từ dự toán chào giá</span>, chọn bản",
    b(
      { t: "Đổ từ dự toán chào giá", m: "chọn bản dự toán của dự án" },
      { t: "Xem trước", m: "dòng gộp theo nhóm chi phí, dùng tên gọn" },
      { t: "Bấm Đổ xuống", m: "chỉ thêm mới, không xoá dòng đã có. Dự án đã có dự toán: tránh đổ hai lần", k: "luu-y" },
    ),
  ),
  d(
    "Bấm nút bảng ▤ ở dòng cần bóc",
    b(
      { t: "Bấm nút ▤", m: "ở dòng cần bóc" },
      { t: "Chọn file Excel", m: "app tự nhận định dạng, hiện từng dòng" },
      { t: "Kiểm tra tổng" },
      { t: "Xác nhận & đặt khối lượng", m: "KL thiết kế = tổng bảng bóc, ô bị khoá (▤)", k: "xong" },
      {
        t: "Về sau",
        hoac: [
          { t: "Bản vẽ đổi", m: "nạp lại file mới" },
          { t: "Muốn nhập tay", m: "Gỡ bảng bóc" },
        ],
      },
    ),
  ),
  d(
    "Đơn cần duyệt: vào",
    b(
      { t: "Gửi đề xuất", m: "Phê duyệt › Mua hàng / vật tư. Còn Chờ duyệt thì xoá được" },
      { t: "Ban giám đốc duyệt", m: "được duyệt mới đặt hàng" },
      { t: "Thêm đơn hàng", m: "tên đơn, loại, nhà cung cấp, ngày đặt, dự kiến giao" },
      { t: "Thêm vật tư vào đơn", m: "quy cách, số lượng, đơn giá, kg. Ảnh biên dạng nếu có" },
      { t: "Chuyển trạng thái", m: "Nháp → Đã đặt → Đã nhận, điền Ngày nhận khi hàng về" },
      { t: "Đối chiếu dự toán", m: "Gom theo Nhóm vật tư hoặc Hạng mục", k: "xong" },
    ),
  ),

  // ---------- Kế toán ----------
  d(
    "Khi hợp đồng ký: ở cột",
    b(
      { t: "Thêm đợt THU", m: "từ Chủ đầu tư: tên đợt, số tiền, hạn" },
      { t: "Thêm đợt CHI", m: "cho NCC / thầu phụ: tên đợt, số tiền, hạn, NCC" },
      { t: "Tiền về / tiền đi", m: "điền ngày thực tế và số tiền thực tế", k: "luu-y" },
      { t: "Bấm Đã thu / Đã trả", m: "không điền ngày thì lấy hôm nay" },
      { t: "Theo dõi đầu cột", m: "Kế hoạch · Thực tế · Còn lại", k: "xong" },
    ),
  ),
  d(
    "<b>Tổng hợp</b>: doanh thu",
    b(
      { t: "Nạp file quyết toán", m: "gửi Ban giám đốc nạp ở Tiện ích › Nhập từ Excel, mỗi file một dự án" },
      { t: "Tổng hợp", m: "doanh thu, chi phí, lợi nhuận, biên, còn phải thu từng dự án" },
      { t: "Bấm dự án", m: "xem chi tiết theo nhóm A–K" },
      { t: "Theo kỳ", m: "chọn Tháng / Quý / Năm, so với kỳ trước", k: "xong" },
      { t: "Ô bằng 0 bất thường?", m: "đọc dòng giải thích — thường thiếu ngày thực tế", k: "luu-y" },
    ),
  ),
];

/** Chèn sơ đồ lên trên mỗi danh sách bước đã khai báo, và gập danh sách chữ lại bên dưới. */
export function themSoDo(html: string): string {
  return html.replace(/<ol class="steps">[\s\S]*?<\/ol>/g, (ol) => {
    const e = SO_DO.find((x) => ol.includes(x.khoa));
    if (!e) return ol;
    return `${e.sodo.map(flow).join("")}<details class="chi-tiet"><summary>Xem chi tiết từng bước</summary>${ol}</details>`;
  });
}

const PHONG: Record<Phong, string> = {
  bgd: "Ban giám đốc",
  kd: "Kinh doanh",
  kt: "Kỹ thuật",
  vt: "Vật tư",
  ke: "Kế toán",
};

/** Mười hai bước đời một công trình, tô màu theo phòng chịu trách nhiệm. */
export function soDoVongDoi(): string {
  const bước: [Phong, string, string][] = [
    ["kd", "Ghi khách mới", "và từng lần trao đổi · Khách hàng (CRM)"],
    ["kd", "Thêm công trình đang hỏi giá", "chưa cần mã dự án · CRM"],
    ["kd", "Lập dự toán chào giá", "từ bộ hạng mục chuẩn · Chào giá › Dự toán"],
    ["kd", "Báo giá gửi khách", "in PDF, gửi, đàm phán → Đã chốt"],
    ["kd", "Ký hợp đồng → tạo dự án", "sinh mã Nxxx, khách thành chủ đầu tư"],
    ["bgd", "Gán người phụ trách", "Trang dự án › Thành viên dự án"],
    ["kd", "Nhập hợp đồng", "đẩy giá bán vào dự án"],
    ["vt", "Đổ dự toán thi công", "gán NCC, bảng bóc · Trang dự án › Mở dự toán"],
    ["vt", "Đề xuất → duyệt → đặt hàng", "Phê duyệt, Đơn hàng & Mua hàng"],
    ["kt", "Bản vẽ, shop, gia công, lắp dựng", "mốc tiến độ và nhật ký"],
    ["ke", "Thu CĐT, trả NCC theo đợt", "Trang dự án › Thanh toán theo đợt"],
    ["ke", "Quyết toán, công nợ, báo cáo", "Chi phí & báo cáo, Công nợ"],
  ];
  const nut = bước
    .map(
      ([p, t, m], i) =>
        `<li class="nd ${p}"><em>${i + 1}</em><div><b>${t}</b><span>${m}</span><u>${PHONG[p]}</u></div></li>`,
    )
    .join("");
  const chuThich = (Object.keys(PHONG) as Phong[])
    .map((p) => `<span class="${p}"><i></i>${PHONG[p]}</span>`)
    .join("");
  return `<ol class="flow vong-doi">${nut}</ol><div class="flow-chu-thich">${chuThich}</div>`;
}
