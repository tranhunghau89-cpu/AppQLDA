// Nội dung sổ tay hướng dẫn sử dụng — HTML tĩnh do chính dự án viết, không có dữ liệu
// người dùng nào đi vào đây. Sửa sổ tay thì sửa thẳng chuỗi này; kiểu dáng ở
// soTay.module.css.
//
// Để dạng HTML chứ không phải JSX vì đây là một văn bản dài ~500 dòng: đổi sang JSX chỉ
// thêm hàng trăm cặp {" "} và className mà không thêm được gì cho người đọc hay người sửa.
export const NOI_DUNG_SO_TAY = `
  <aside class="toc">
    <nav aria-label="Mục lục">
      <div>
        <h4>Chung cho mọi người</h4>
        <ul>
          <li><a href="#bat-dau">Đăng nhập & giao diện</a></li>
          <li><a href="#thao-tac-chung">Thao tác dùng chung</a></li>
          <li><a href="#luong">Vòng đời một công trình</a></li>
          <li><a href="#quyen">Ai được làm gì</a></li>
        </ul>
      </div>
      <div>
        <h4>Theo phòng ban</h4>
        <ul>
          <li class="dept"><a href="#bgd">Ban giám đốc / Quản lý</a></li>
          <li class="sub"><a href="#bgd-nguoi-dung">Tài khoản người dùng</a></li>
          <li class="sub"><a href="#bgd-phan-cong">Phân công dự án & khách</a></li>
          <li class="sub"><a href="#bgd-thu-vien">Thư viện đơn giá</a></li>
          <li class="sub"><a href="#bgd-bo-hang-muc">Bộ hạng mục chuẩn</a></li>
          <li class="sub"><a href="#bgd-duyet">Duyệt đề xuất</a></li>
          <li class="sub"><a href="#bgd-theo-doi">Theo dõi & báo cáo</a></li>

          <li class="dept"><a href="#kd">Phòng Kinh doanh</a></li>
          <li class="sub"><a href="#kd-khach">Khách hàng & trao đổi</a></li>
          <li class="sub"><a href="#kd-du-toan">Dự toán chào giá</a></li>
          <li class="sub"><a href="#kd-bao-gia">Báo giá gửi khách</a></li>
          <li class="sub"><a href="#kd-tao-du-an">Ký hợp đồng → tạo dự án</a></li>
          <li class="sub"><a href="#kd-hop-dong">Hợp đồng & hồ sơ</a></li>

          <li class="dept"><a href="#kt">Phòng Kỹ thuật</a></li>
          <li class="sub"><a href="#kt-du-an">Thông tin dự án</a></li>
          <li class="sub"><a href="#kt-tien-do">Mốc tiến độ & Gantt</a></li>
          <li class="sub"><a href="#kt-nhat-ky">Nhật ký & shopdrawing</a></li>
          <li class="sub"><a href="#kt-tra-cuu">Tra cứu & bóc khối lượng</a></li>

          <li class="dept"><a href="#vt">Phòng Vật tư</a></li>
          <li class="sub"><a href="#vt-du-toan">Dự toán thi công</a></li>
          <li class="sub"><a href="#vt-bang-boc">Bảng bóc từ Excel</a></li>
          <li class="sub"><a href="#vt-don-hang">Đơn hàng</a></li>
          <li class="sub"><a href="#vt-ncc">Nhà cung cấp</a></li>

          <li class="dept"><a href="#ke-toan">Phòng Kế toán</a></li>
          <li class="sub"><a href="#kt2-dot">Thu – chi theo đợt</a></li>
          <li class="sub"><a href="#kt2-cong-no">Công nợ</a></li>
          <li class="sub"><a href="#kt2-chi-phi">Chi phí & báo cáo kỳ</a></li>
        </ul>
      </div>
    </nav>
  </aside>

  <main>
    <header class="intro">
      <div class="eyebrow">Hướng dẫn sử dụng · bản 09/2026</div>
      <h1>Sổ tay QLDA Kết cấu thép</h1>
      <p class="lede">Viết theo việc từng người làm mỗi ngày: đọc phần <a href="#bat-dau">chung</a> một lần, rồi nhảy tới phòng ban của mình. Mỗi việc ghi rõ vào đâu trên menu, bấm nút nào, theo thứ tự nào. Tên nút in <span class="ui">như thế này</span>, đường đi trên menu in <span class="path">như thế này</span>.</p>
      <div class="meta"><span>Thay cho bộ PDF hướng dẫn tháng 07/2026</span><span>Có thêm: CRM, chào giá, thư viện đơn giá, sửa trực tiếp trên bảng</span></div>
    </header>

    <!-- ================= CHUNG ================= -->
    <section class="part" id="bat-dau">
      <h2>Đăng nhập & giao diện</h2>

      <div class="task">
        <h3>Đăng nhập lần đầu</h3>
        <ol class="steps">
          <li>Mở trình duyệt (Chrome, Edge, Cốc Cốc hoặc Safari trên điện thoại), vào địa chỉ app quản trị viên gửi. Hiện là <span class="path">app-qlda.vercel.app</span>.</li>
          <li>Nhập <b>email</b> và <b>mật khẩu</b> quản trị viên cấp, bấm <span class="ui">Đăng nhập</span>.</li>
          <li>Góc trên bên phải hiện tên bạn và vai trò (ví dụ “Kinh doanh / CĐT”). Sai vai trò thì báo quản trị viên sửa trước khi làm việc.</li>
        </ol>
        <p class="tip"><b>Quên mật khẩu?</b>Nhờ Ban giám đốc / Quản lý đặt mật khẩu mới cho bạn ở <span class="path">Người dùng</span>. App không tự gửi email khôi phục.</p>
      </div>

      <div class="task">
        <h3>Menu bên trái</h3>
        <p>Menu xếp theo nhịp làm việc. Mỗi người chỉ thấy các mục mình có quyền xem.</p>
        <div class="tbl"><table>
          <thead><tr><th>Nhóm</th><th>Mục</th><th>Dùng để</th></tr></thead>
          <tbody>
            <tr><td rowspan="2"><b>Bán hàng</b><br><span style="color:var(--muted);font-size:13px">trước hợp đồng</span></td><td>Khách hàng (CRM)</td><td>Khách đang trao đổi, công trình đang chào giá, nhật ký gọi/gặp khách</td></tr>
            <tr><td>Chào giá</td><td>Hai tab: <b>Dự toán</b> (bảng tính giá thành theo Mã CV) và <b>Báo giá gửi khách</b> (bản m² in cho khách)</td></tr>
            <tr><td rowspan="7"><b>Thi công</b><br><span style="color:var(--muted);font-size:13px">sau hợp đồng</span></td><td>Dự án</td><td>Danh sách dự án, trang chi tiết từng dự án</td></tr>
            <tr><td>Tiến độ</td><td>Hai tab: <b>Theo tuần</b> và <b>Gantt</b></td></tr>
            <tr><td>Phê duyệt</td><td>Gửi đề xuất mua hàng / thanh toán; Ban giám đốc duyệt</td></tr>
            <tr><td>Dự toán thi công & chi phí</td><td>Chi phí, lợi nhuận từng dự án</td></tr>
            <tr><td>Hợp đồng & Báo giá</td><td>Hợp đồng đã ký, giá trị, file</td></tr>
            <tr><td>Đơn hàng & Mua hàng</td><td>Đơn đặt vật tư gửi nhà cung cấp</td></tr>
            <tr><td>Chi phí & báo cáo · Công nợ</td><td>Quyết toán, báo cáo theo tháng/quý/năm, phải thu – phải trả</td></tr>
            <tr><td rowspan="5"><b>Danh mục & hệ thống</b></td><td>Thư viện đơn giá</td><td>Công tác, đơn giá theo ngày, vật tư, khu vực, bộ hạng mục chuẩn</td></tr>
            <tr><td>Chủ đầu tư & NCC</td><td>Hai tab: danh bạ chủ đầu tư và nhà cung cấp</td></tr>
            <tr><td>Tiện ích</td><td>Ba tab: Tra cứu & Bóc KL · Nhập từ Excel · Nhật ký thay đổi</td></tr>
            <tr><td>Sổ tay hướng dẫn</td><td>Chính trang này — ai đăng nhập cũng đọc được</td></tr>
            <tr><td>Người dùng</td><td>Tài khoản và vai trò (chỉ Ban giám đốc)</td></tr>
          </tbody>
        </table></div>
        <p>Bấm vào tiêu đề nhóm (ví dụ “BÁN HÀNG”) để thu gọn nhóm đó. App nhớ lựa chọn trên máy bạn.</p>
      </div>
    </section>

    <section class="part" id="thao-tac-chung">
      <h2>Thao tác dùng chung</h2>
      <div class="task">
        <h3>Những thứ xuất hiện ở mọi trang</h3>
        <div class="shortcuts">
          <div><b>Tìm kiếm <kbd>Ctrl</kbd> <kbd>K</kbd></b><span>Ô tìm trên đầu trang. Gõ mã dự án (N037), tên chủ đầu tư, nhà cung cấp, số hợp đồng, báo giá hoặc mã đơn giá để nhảy thẳng tới. Khách trong CRM thì tìm ở trang Khách hàng.</span></div>
          <div><b>Nút <span class="ui">Nhập nhanh</span></b><span>Nút tròn góc dưới phải. Ghi tiến độ, đơn hàng, khối lượng hay đợt thanh toán cho một dự án mà không phải mở trang dự án.</span></div>
          <div><b>Thanh tải xanh</b><span>Vạch mảnh chạy trên đỉnh màn hình khi app đang tải hoặc đang lưu. Chờ vạch chạy hết rồi hãy bấm tiếp.</span></div>
          <div><b>Nút mũi tên ←</b><span>Cạnh tiêu đề trang: quay về danh sách hoặc trang dự án.</span></div>
        </div>
      </div>

      <div class="task">
        <h3>Sửa số ngay trên bảng</h3>
        <p class="where">Dùng ở: dự toán chào giá, bảng giá vốn trong báo giá gửi khách, dự toán thi công</p>
        <ol class="steps">
          <li>Bấm vào ô số (khối lượng, giá gốc, đơn giá bán, đơn giá). Ô hiện khung xanh, gõ được ngay.</li>
          <li>Gõ số kiểu Việt: <b>20.580</b> là hai mươi nghìn năm trăm tám mươi; <b>5,6</b> là năm phẩy sáu. Có thể gõ công thức bắt đầu bằng dấu bằng, ví dụ <b>=12*1000</b> hay <b>=25*60</b>. Kết quả hiện ngay dưới ô.</li>
          <li>Bấm <kbd>Enter</kbd> hoặc bấm ra ngoài để <b>lưu</b>. Bấm <kbd>Esc</kbd> để <b>bỏ</b>, ô trở về số cũ.</li>
        </ol>
        <p class="tip"><b>Ô có dấu ∑ hoặc ▤ không sửa được.</b>∑ nghĩa là khối lượng tự tính từ dòng khác (ví dụ vận chuyển, lắp dựng tính theo tổng thép). ▤ nghĩa là khối lượng lấy từ bảng bóc. Muốn đổi thì sửa dòng thép gốc hoặc bảng bóc; di chuột lên ô để xem lý do.</p>
      </div>

      <div class="task">
        <h3>Đổi tên hoặc chọn công việc khác ngay trên bảng</h3>
        <p class="where">Dùng ở: cột “Nội dung công việc” của dự toán chào giá và dự toán thi công</p>
        <ol class="steps">
          <li>Bấm vào tên công việc. Danh sách công tác của thư viện hiện ngay bên dưới, mỗi dòng có mã, đơn vị và đơn giá chung.</li>
          <li><b>Chỉ đổi tên:</b> sửa chữ như sửa văn bản, rồi <kbd>Enter</kbd> hoặc <kbd>Tab</kbd>. Dòng vẫn giữ công tác đang gắn.</li>
          <li><b>Đổi sang công việc khác:</b> bấm vào công tác trong danh sách. Muốn tìm thì xoá tên cũ rồi gõ vài chữ — không cần dấu, không cần đúng thứ tự (“thep hinh”, “Q345 tổ hợp”, “AA.210” đều được). Dùng <kbd>↑</kbd> <kbd>↓</kbd> rồi <kbd>Enter</kbd> nếu thích bàn phím.</li>
          <li><kbd>Esc</kbd> để thôi, tên giữ nguyên.</li>
        </ol>
        <p>Khi đổi công việc, dòng lấy theo công tác mới: mã, tên, đơn vị và <b>đơn giá thư viện theo khu vực</b> (đơn giá bán tự tính lại theo hệ số TL). <b>Khối lượng, nhóm, ghi chú, nhà cung cấp giữ nguyên.</b> Thư viện chưa có giá cho công tác mới thì giữ giá cũ.</p>
      </div>

      <div class="task">
        <h3>Dùng trên điện thoại</h3>
        <ul class="bul">
          <li>Bấm biểu tượng ☰ (Mở menu) góc trên bên trái để mở menu.</li>
          <li>Bảng rộng thì vuốt ngang trong bảng; trang không bị lệch.</li>
          <li>Việc hợp làm trên điện thoại nhất: <span class="ui">Nhập nhanh</span> tiến độ kèm ảnh ở công trường, xem công nợ, duyệt đề xuất.</li>
        </ul>
      </div>
    </section>

    <section class="part" id="luong">
      <h2>Vòng đời một công trình</h2>
      <p class="part-lede">Một công trình đi qua app theo thứ tự dưới đây. Mỗi bước có một phòng chịu trách nhiệm; bước sau dùng lại dữ liệu bước trước, không ai phải gõ lại.</p>
      <div class="tbl"><table>
        <thead><tr><th>#</th><th>Việc</th><th>Phòng làm</th><th>Ở đâu</th></tr></thead>
        <tbody>
          <tr><td class="n">1</td><td>Ghi khách mới, ghi từng lần trao đổi</td><td>Kinh doanh</td><td><span class="path">Khách hàng (CRM)</span></td></tr>
          <tr><td class="n">2</td><td>Thêm công trình khách đang hỏi giá (chưa cần mã dự án)</td><td>Kinh doanh</td><td><span class="path">Khách hàng (CRM)</span></td></tr>
          <tr><td class="n">3</td><td>Lập dự toán chào giá từ bộ hạng mục chuẩn, giá lấy từ thư viện</td><td>Kinh doanh</td><td><span class="path">Chào giá › Dự toán</span></td></tr>
          <tr><td class="n">4</td><td>Tạo báo giá gửi khách, in PDF, gửi, đàm phán, <b>Đã chốt</b></td><td>Kinh doanh</td><td><span class="path">Chào giá › Báo giá gửi khách</span></td></tr>
          <tr><td class="n">5</td><td>Ký hợp đồng → tạo dự án (sinh mã Nxxx), chuyển khách thành chủ đầu tư</td><td>Kinh doanh / BGĐ</td><td><span class="path">Khách hàng (CRM)</span></td></tr>
          <tr><td class="n">6</td><td>Gán người phụ trách vào dự án</td><td>Ban giám đốc</td><td>Trang dự án › Thành viên dự án</td></tr>
          <tr><td class="n">7</td><td>Nhập hợp đồng, đẩy giá bán vào dự án</td><td>Kinh doanh</td><td><span class="path">Hợp đồng & Báo giá</span></td></tr>
          <tr><td class="n">8</td><td>Đổ dự toán chào giá xuống dự toán thi công, gán nhà cung cấp, bảng bóc</td><td>Vật tư</td><td>Trang dự án › Mở dự toán</td></tr>
          <tr><td class="n">9</td><td>Đề xuất mua hàng → duyệt → đặt hàng</td><td>Vật tư → BGĐ</td><td><span class="path">Phê duyệt</span>, <span class="path">Đơn hàng & Mua hàng</span></td></tr>
          <tr><td class="n">10</td><td>Bản vẽ, shop, gia công, lắp dựng: mốc tiến độ và nhật ký</td><td>Kỹ thuật</td><td>Trang dự án, <span class="path">Tiến độ</span></td></tr>
          <tr><td class="n">11</td><td>Thu tiền chủ đầu tư, trả nhà cung cấp theo đợt</td><td>Kế toán</td><td>Trang dự án › Thanh toán theo đợt</td></tr>
          <tr><td class="n">12</td><td>Quyết toán, công nợ, báo cáo theo kỳ</td><td>Kế toán, BGĐ</td><td><span class="path">Chi phí & báo cáo</span>, <span class="path">Công nợ</span></td></tr>
        </tbody>
      </table></div>
    </section>

    <section class="part" id="quyen">
      <h2>Ai được làm gì</h2>
      <p class="part-lede">Ngoài vai trò, còn một lớp phạm vi: <b>Ban giám đốc thấy mọi dự án</b>; các phòng khác chỉ thấy dự án mình được gán làm thành viên. Trong CRM, nhân viên thấy khách mình phụ trách và khách chưa giao cho ai.</p>
      <div class="tbl"><table class="matrix">
        <thead><tr><th>Mục</th><th>Ban giám đốc</th><th>Kinh doanh</th><th>Kỹ thuật</th><th>Vật tư</th><th>Kế toán</th></tr></thead>
        <tbody>
          <tr><td>Khách hàng (CRM)</td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Chào giá (dự toán & báo giá khách)</td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Dự án (thông tin, nhật ký, NCC theo hạng mục)</td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Tiến độ (mốc, Gantt, shopdrawing)</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td></tr>
          <tr><td>Dự toán thi công</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Hợp đồng</td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Đơn hàng & mua hàng</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Chi phí, thanh toán theo đợt</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td></tr>
          <tr><td>Công nợ</td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td></tr>
          <tr><td>Lợi nhuận</td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td><td><span class="p o">—</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Thư viện đơn giá, bộ hạng mục</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Chủ đầu tư</td><td><span class="p s">Sửa</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p o">—</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Nhà cung cấp</td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td><td><span class="p x">Xem</span></td><td><span class="p s">Sửa</span></td><td><span class="p x">Xem</span></td></tr>
          <tr><td>Phê duyệt</td><td><span class="p s">Duyệt</span></td><td><span class="p x">Gửi</span></td><td><span class="p x">Gửi</span></td><td><span class="p x">Gửi</span></td><td><span class="p x">Gửi</span></td></tr>
          <tr><td>Nhập Excel, Nhật ký thay đổi, Người dùng</td><td><span class="p s">Có</span></td><td><span class="p o">—</span></td><td><span class="p o">—</span></td><td><span class="p o">—</span></td><td><span class="p o">—</span></td></tr>
        </tbody>
      </table></div>
      <div class="legend"><span><span class="p s">Sửa</span> thêm, sửa, xoá</span><span><span class="p x">Xem</span> chỉ xem, không có nút sửa</span><span><span class="p o">—</span> không thấy mục này</span></div>
    </section>

    <!-- ================= BAN GIÁM ĐỐC ================= -->
    <section class="part" id="bgd">
      <h2>Ban giám đốc / Quản lý <span class="role-tag">vai trò ADMIN</span></h2>
      <p class="part-lede">Người giữ ba thứ mà mọi phòng khác dựa vào: tài khoản và phân công, thư viện đơn giá, và quyết định duyệt.</p>

      <div class="task" id="bgd-nguoi-dung">
        <h3>Tạo, sửa, khoá tài khoản người dùng</h3>
        <p class="where"><span class="path">Người dùng</span></p>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm người dùng</span>. Điền <b>Tên</b>, <b>Email</b> (dùng để đăng nhập), <b>Số điện thoại</b>.</li>
          <li>Chọn <b>Vai trò</b> đúng phòng: Ban giám đốc / Quản lý · Kinh doanh / CĐT · Kỹ thuật / Thiết kế · Vật tư / Mua hàng · Kế toán / Tài chính.</li>
          <li>Đặt <b>Mật khẩu</b> tối thiểu 6 ký tự, lưu, rồi gửi email + mật khẩu cho người đó.</li>
          <li>Đổi mật khẩu cho ai quên: bấm bút sửa ở dòng người đó, gõ <b>Mật khẩu mới</b>. Để trống là giữ mật khẩu cũ.</li>
          <li>Người nghỉ việc: sửa và bỏ tích <b>Tài khoản hoạt động</b> — dòng đó hiện nhãn <b>Khóa</b> và không đăng nhập được nữa. Không xoá: lịch sử họ đã ghi vẫn giữ tên.</li>
        </ol>
      </div>

      <div class="task" id="bgd-phan-cong">
        <h3>Phân công người vào dự án và giao khách cho kinh doanh</h3>
        <p class="where">Trang chi tiết dự án › Thành viên dự án · <span class="path">Khách hàng (CRM)</span></p>
        <h5>Gán thành viên dự án</h5>
        <ol class="steps">
          <li>Mở <span class="path">Dự án</span>, bấm vào mã dự án.</li>
          <li>Ở khung <b>Thành viên dự án</b>, chọn người trong ô “— Chọn người để gán —”, bấm <span class="ui">Gán</span>.</li>
          <li>Người được gán mới thấy dự án đó trong danh sách, trong <span class="ui">Nhập nhanh</span> và các báo cáo. Gán đủ cả kỹ thuật, vật tư, kế toán phụ trách công trình.</li>
        </ol>
        <p class="warn"><b>Chưa gán = không thấy.</b>Nhân viên báo “không tìm thấy dự án” thì gần như luôn là chưa được gán vào dự án đó.</p>
        <h5>Giao khách cho nhân viên kinh doanh</h5>
        <ol class="steps">
          <li>Mở <span class="path">Khách hàng (CRM)</span>, bấm bút sửa ở dòng khách.</li>
          <li>Chọn <b>Người phụ trách</b>, lưu. Khách “Chưa phân công” thì mọi nhân viên kinh doanh đều thấy — nên giao sớm để rõ ai theo.</li>
        </ol>
      </div>

      <div class="task" id="bgd-thu-vien">
        <h3>Giữ thư viện đơn giá luôn đúng</h3>
        <p class="where"><span class="path">Thư viện đơn giá</span> — chỉ Ban giám đốc sửa; các phòng khác dùng giá ở đây</p>
        <p>Thư viện là nguồn giá cho mọi bản dự toán. Mỗi dòng dự toán <b>chụp lại giá lúc lập</b>; sửa thư viện không làm đổi bản đã lập, chỉ hiện huy hiệu lệch giá để người lập tự quyết cập nhật.</p>
        <h5>Thêm hoặc sửa một công tác</h5>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm công tác</span>. Điền <b>Mã công tác</b> theo nhóm (AA.110 kết cấu thép, AB bulong neo, AC bulong liên kết, AD tôn & diềm…), <b>Đơn vị</b>, <b>Nội dung công tác</b> đầy đủ kèm thông số.</li>
          <li><b>Loại (rút gọn)</b> là tên ngắn dùng trên dự toán thi công và bảng giá vốn — ví dụ “Thép tổ hợp”. Nên điền.</li>
          <li>Chọn <b>Nhóm chi phí</b> (Kết cấu thép, Xà gồ, Tôn – Diềm, Bulong neo…). Nhóm này quyết định dòng rơi vào nhóm nào khi đổ xuống dự toán thi công.</li>
        </ol>
        <h5>Đổi giá — thêm bản giá mới, không sửa đè</h5>
        <ol class="steps">
          <li>Bấm vào tên công tác để mở trang chi tiết, xem <b>Lịch sử đơn giá</b>.</li>
          <li>Bấm <span class="ui">Thêm bản giá</span>, chọn <b>Hiệu lực từ ngày</b>.</li>
          <li>Chọn phạm vi: <b>Áp dụng cho vật liệu</b> (hoặc “Mọi vật liệu”) và <b>Áp dụng cho khu vực</b> (hoặc “Toàn quốc”).</li>
          <li>Nhập <b>Vật tư (VT)</b>, <b>NC + Máy</b>, <b>Hệ số (HS)</b> để app tính, hoặc gõ thẳng <b>Đơn giá trọn gói</b>. Ghi nguồn vào ghi chú (“báo giá DMF 05/09”). Bấm <span class="ui">Lưu bản giá</span>.</li>
        </ol>
        <p class="tip"><b>App chọn giá thế nào?</b>Với mỗi dòng, app lấy bản giá có hiệu lực mới nhất, ưu tiên bản khớp đúng vật liệu, rồi đúng khu vực của bản dự toán; không có thì dùng giá chung toàn quốc.</p>
        <h5>Biến thể vật liệu, vật tư, khu vực</h5>
        <ul class="bul">
          <li><b>Biến thể vật liệu</b> (trang chi tiết công tác): cùng công tác “lợp tôn” nhưng tôn Hoa Sen 0,45 và tôn Đông Á 0,40 là hai giá. Bấm <span class="ui">Thêm biến thể vật liệu</span>, chọn vật tư, đặt một cái làm mặc định.</li>
          <li><b>Vật tư</b> (<span class="path">Thư viện đơn giá › Vật tư</span>): tên, hãng, quy cách, xuất xứ. <b>Quy cách</b> in ra bảng thông số kỹ thuật của báo giá khách. Mở <span class="ui">Xem giá mua</span> để ghi giá mua theo từng nhà cung cấp.</li>
          <li><b>Khu vực</b> (<span class="path">Thư viện đơn giá › Khu vực</span>): ví dụ Miền Bắc, Tây Ninh. Gán nhà cung cấp phục vụ từng khu vực; dự toán thi công của dự án thuộc khu vực nào sẽ đưa những nhà cung cấp đó lên đầu danh sách.</li>
        </ul>
      </div>

      <div class="task" id="bgd-bo-hang-muc">
        <h3>Soạn bộ hạng mục chuẩn</h3>
        <p class="where"><span class="path">Thư viện đơn giá › Bộ hạng mục chuẩn</span></p>
        <p>Bộ hạng mục là khung dự toán dựng sẵn cho một loại công trình (ví dụ “Nhà xưởng kết cấu thép + bao che”): các phần A Khung mái, B Vách…, trong mỗi phần là các dòng công tác đã gắn mã. Kinh doanh áp bộ vào dự toán là có ngay đủ dòng, chỉ còn nhập khối lượng.</p>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm bộ hạng mục</span>: <b>Mã</b>, <b>Tên bộ</b>, <b>Loại công trình</b> (để trống = dùng chung).</li>
          <li>Thêm các <b>phần</b>: mã phần (A, B…), tên nội bộ, và tên in cho khách nếu khác.</li>
          <li>Trong mỗi phần, thêm dòng và bấm ô mã để <b>chọn mã công việc trong thư viện</b>. Ghi nhóm (Bulong neo, Kết cấu thép…) và ghi chú (ví dụ “Q345”).</li>
          <li>Cột <b>Suất / m²</b>: khối lượng trên một m² diện tích phần, dùng để app gợi ý sẵn khối lượng khi áp bộ. Có thể <span class="ui">Lấy từ bản dự toán</span> một công trình đã làm.</li>
        </ol>
        <p class="warn"><b>Ghi chú trong bộ được chép vào dự toán.</b>Sửa ghi chú (ví dụ Q355 → Q345) chỉ ảnh hưởng những lần áp bộ sau; dòng đã áp trước đó phải sửa riêng.</p>
      </div>

      <div class="task" id="bgd-duyet">
        <h3>Duyệt hoặc từ chối đề xuất</h3>
        <p class="where"><span class="path">Phê duyệt</span></p>
        <ol class="steps">
          <li>Bấm bộ lọc <b>Chờ duyệt</b> để xem đề xuất đang đợi.</li>
          <li>Đọc tiêu đề, số tiền, dự án, nội dung. Bấm <span class="ui">Duyệt</span> (ghi chú có thể bỏ trống) hoặc <span class="ui">Từ chối</span> (bắt buộc ghi <b>lý do</b> để người gửi sửa lại).</li>
        </ol>
      </div>

      <div class="task" id="bgd-theo-doi">
        <h3>Theo dõi toàn cảnh và báo cáo</h3>
        <ul class="bul">
          <li><span class="path">Tổng quan</span>: số dự án theo trạng thái, lợi nhuận dự kiến, giá bán so với chi phí từng dự án. <span class="ui">Xuất báo cáo Excel</span> để gửi họp.</li>
          <li><span class="path">Chi phí & báo cáo › Theo kỳ</span>: chọn Tháng / Quý / Năm — tiền đã thu, đã chi, dòng tiền ròng, hợp đồng ký mới, đơn hàng, so với kỳ trước.</li>
          <li><span class="path">Tiện ích › Nhật ký thay đổi</span>: ai sửa gì, lúc nào, giá trị trước → sau. Trang dự án cũng có khung <b>Lịch sử thay đổi</b> riêng.</li>
          <li><span class="path">Tiện ích › Nhập từ Excel</span>: nạp dự toán (sheet TongHop), quyết toán / sổ giá thành, đơn hàng DH_*.xlsx, bảng giá BG_*.xlsx. Luôn bấm <span class="ui">Xem trước</span>, đọc cảnh báo rồi mới ghi.</li>
          <li><b>Nhắc việc 8 giờ sáng</b>: mỗi ngày app gom mốc tiến độ trễ, đợt thanh toán quá hạn hoặc tới hạn trong 7 ngày, báo giá sắp hết hiệu lực. Muốn nhận qua nhóm chat, báo bộ phận kỹ thuật app cấu hình.</li>
        </ul>
      </div>
    </section>

    <!-- ================= KINH DOANH ================= -->
    <section class="part" id="kd">
      <h2>Phòng Kinh doanh <span class="role-tag">vai trò Kinh doanh / CĐT</span></h2>
      <p class="part-lede">Từ cuộc gọi đầu tiên tới lúc ký hợp đồng. Không cần tạo dự án hay mã dự án cho tới khi khách ký.</p>

      <div class="task" id="kd-khach">
        <h3>Ghi khách mới và nhật ký trao đổi</h3>
        <p class="where"><span class="path">Khách hàng (CRM)</span></p>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm khách</span>. Chỉ bắt buộc <b>Tên khách / công ty</b> — biết tới đâu ghi tới đó, có khi chỉ là tên người.</li>
          <li>Điền thêm nếu có: người liên hệ, điện thoại, email, địa chỉ, <b>Nguồn khách</b> (được giới thiệu, website, khách gọi đến, triển lãm…), người phụ trách.</li>
          <li>Bấm vào dòng khách để mở rộng. Ở phần nhật ký, mỗi lần gọi / gặp / Zalo / email ghi một dòng: <b>Hình thức</b>, <b>Ngày liên hệ</b>, <b>Nội dung trao đổi</b>, và <b>Hẹn liên hệ lại</b> nếu có.</li>
        </ol>
      </div>

      <div class="task">
        <h3>Thêm công trình đang chào giá</h3>
        <p class="where"><span class="path">Khách hàng (CRM)</span> › mở dòng khách › Công trình chào giá</p>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm công trình</span>. Điền <b>Tên công trình</b>, địa điểm, loại công trình, diện tích, bước khung K, chiều dài L, chiều cao H.</li>
          <li>Theo dõi <b>Trạng thái</b>: Mới → Đang chào giá → Đang đàm phán. Mất khách thì chọn <b>Mất khách</b> và ghi <b>Lý do mất khách</b> — để sau này biết vì giá, vì tiến độ hay khách hoãn.</li>
          <li>Từ thẻ công trình bấm <span class="ui">Lập dự toán chi tiết</span> hoặc <span class="ui">Lập báo giá gửi khách</span>.</li>
        </ol>
      </div>

      <div class="task" id="kd-du-toan">
        <h3>Lập dự toán chào giá</h3>
        <p class="where"><span class="path">Chào giá › Dự toán</span> · hoặc từ thẻ công trình trong CRM</p>
        <p>Dự toán chào giá là bảng giá thành theo Mã CV: có giá gốc (vốn) và đơn giá bán = giá gốc × hệ số TL. Báo giá m² gửi khách dựa trên bảng này.</p>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm báo giá</span>. Đặt tiêu đề, <b>hệ số TL</b> (ví dụ 1,15), chọn <b>khu vực</b> để app tra đúng giá vùng.
            <br>Có công trình tương tự đã làm? Bấm <span class="ui">Tạo từ dự án khác</span> để chép nguyên bản đó rồi sửa.</li>
          <li>Bấm <span class="ui">Áp bộ hạng mục</span>, chọn bộ phù hợp. Bước xem trước cho biết sẽ thêm những phần nào; nhập <b>diện tích từng phần</b> để app gợi ý khối lượng theo suất / m². Áp được cả vào bản đã có dòng — chỉ thêm phần còn thiếu.</li>
          <li>Nhập <b>Khối lượng</b> từng dòng ngay trên bảng. Dòng vận chuyển, lắp dựng có dấu ∑ tự tính theo tổng thép, không cần gõ.</li>
          <li>Kiểm tra <b>Giá gốc</b> và <b>Đơn giá bán</b>. Sửa trực tiếp trên ô nếu cần; sửa giá gốc thì đơn giá bán tự tính lại. Dòng sửa tay có nhãn <b>sửa tay</b>.</li>
          <li>Đổi tên hoặc thay công việc khác: bấm vào tên dòng (xem <a href="#thao-tac-chung">thao tác dùng chung</a>). Muốn sửa tên gọn, nhóm, ghi chú, thuộc phần nào thì bấm nút bút cuối dòng.</li>
          <li>Dòng thiếu: bấm <span class="ui">+ Thêm dòng vào A</span> dưới mỗi phần; phần mới: <span class="ui">Thêm phần</span>.</li>
        </ol>
        <h5>Đọc bảng</h5>
        <ul class="bul">
          <li>Mỗi phần chia <b>nhóm đánh số</b> (1 Bulong neo, 2 Kết cấu thép…). Hàng nhóm ghi <b>% hạng mục</b> (nhóm chiếm bao nhiêu trong phần), <b>% tổng</b> (trên cả bản), và giá vốn / giá bán <b>trên mỗi m²</b>.</li>
          <li>Huy hiệu vàng <b>→ 192.000</b> cạnh giá gốc: thư viện đã đổi giá kể từ lúc lập. Bấm <span class="ui">Cập nhật giá từ thư viện</span> để kéo các dòng lệch về giá mới — <b>dòng sửa tay được giữ nguyên</b>.</li>
          <li>Cuối thẻ là tổng giá gốc, giá bán, lợi nhuận. <span class="ui">In / PDF</span> để in bảng nội bộ.</li>
        </ul>
      </div>

      <div class="task" id="kd-bao-gia">
        <h3>Lập, in và theo dõi báo giá gửi khách</h3>
        <p class="where"><span class="path">Chào giá › Báo giá gửi khách</span></p>
        <ol class="steps">
          <li>Cách nhanh nhất: trên thẻ dự toán chào giá bấm <span class="ui">Tạo báo giá gửi khách</span>, chọn <b>Mẫu báo giá</b>. App dựng sẵn các hạng mục m² với đơn giá suy ra từ dự toán.
            <br>Hoặc bấm <span class="ui">Lập báo giá</span> ở danh sách để lập từ đầu (chọn khách, công trình, mẫu).</li>
          <li>Điền đầu báo giá: <b>Số báo giá</b> (BG-2026-014), ngày, <b>Kính gửi</b>, SĐT, địa điểm.</li>
          <li>Sửa hạng mục ngay trên bảng: tên, đơn vị, khối lượng, đơn giá. Hàng trắng cuối mỗi phần: gõ tên rồi <kbd>Enter</kbd> là thêm hạng mục mới.</li>
          <li>Dòng khoán (ví dụ “Cửa đẩy chớp 6 cái”): bấm vào ô thành tiền để <b>chốt cứng thành tiền</b>; bấm dấu × để quay về khối lượng × đơn giá.</li>
          <li>Xem khung <b>Giá vốn theo hạng mục</b> dưới bảng: vốn / m², bán / m² và nhãn lãi màu (đỏ = lỗ, vàng = dưới 10%). Khối lượng và giá vốn sửa được ngay tại đây, ghi thẳng về dự toán chào giá.</li>
          <li><span class="ui">Điều khoản</span>: VAT, hiệu lực, bảo hành, bảo trì, tải trọng mái / treo / sàn, lời mở đầu, ghi chú loại trừ, <b>tiến độ thi công</b> và <b>đợt thanh toán</b>.</li>
          <li>Bảng vật liệu và thông số kỹ thuật: thêm / sửa vật liệu. Vật liệu gắn nhãn (tôn thưng, cửa trời…) chỉ in khi báo giá có hạng mục dùng nó.</li>
          <li><span class="ui">Xem trước bản in</span> rồi <span class="ui">In / Lưu PDF</span> để gửi khách.</li>
          <li>Cập nhật <b>Trạng thái</b>: Nháp → Đã gửi → Đang đàm phán → <b>Đã chốt</b> (hoặc Hủy).</li>
        </ol>
        <p class="tip"><b>Đã sửa dự toán sau khi tạo báo giá?</b>Bấm <span class="ui">Tính lại đơn giá</span> để lấy lại đơn giá từ dự toán. Dòng có nhãn <b>đè giá</b> (đã sửa tay) được giữ; bấm nút ↺ ở dòng đó nếu muốn bỏ đè.</p>
      </div>

      <div class="task" id="kd-tao-du-an">
        <h3>Khách ký hợp đồng → tạo dự án</h3>
        <p class="where"><span class="path">Khách hàng (CRM)</span> › thẻ công trình</p>
        <ol class="steps">
          <li>Bảo đảm công trình có ít nhất một báo giá gửi khách ở trạng thái <b>Đã chốt</b>. Chưa có thì nút tạo dự án không hiện.</li>
          <li>Bấm <span class="ui">Đã ký hợp đồng — tạo dự án</span>.</li>
          <li><b>1. Chủ đầu tư:</b> nếu công ty đã từng ký với mình, chọn chủ đầu tư có sẵn (app gợi ý “Có thể là khách này”); nếu mới thì điền tên pháp nhân, người đại diện, điện thoại, <b>địa chỉ pháp lý theo giấy đăng ký kinh doanh</b>.</li>
          <li><b>2. Dự án:</b> đặt <b>Mã dự án</b> (N0xx) và tên dự án. Thông số công trình được chép sang.</li>
          <li>Xác nhận. Dự toán chào giá và báo giá khách <b>đi theo sang dự án</b>; thẻ công trình hiện “Đã thành dự án N0xx”.</li>
          <li>Báo Ban giám đốc gán thành viên (kỹ thuật, vật tư, kế toán) vào dự án mới.</li>
        </ol>
      </div>

      <div class="task" id="kd-hop-dong">
        <h3>Nhập hợp đồng, đẩy giá bán, ghi phiên bản hồ sơ</h3>
        <p class="where">Trang dự án › <span class="ui">Mở hợp đồng</span></p>
        <h5>Hợp đồng</h5>
        <ol class="steps">
          <li>Bấm <span class="ui">Thêm hợp đồng</span>: số hợp đồng, ngày ký, trích yếu, chủ đầu tư (Bên A), thông tin Bên A (địa chỉ, MST, người đại diện), <b>VAT (%)</b>, điều khoản thanh toán, đường dẫn file hợp đồng.</li>
          <li><b>Trạng thái</b>: Báo giá → <b>Đã ký</b> → Thanh lý.</li>
          <li>Thêm từng hạng mục: tên, đơn vị, khối lượng, đơn giá. Thành tiền để trống thì app tự nhân; tổng trước và sau VAT tự cộng.</li>
        </ol>
        <h5>Đẩy giá bán vào dự án</h5>
        <p>Giá bán dự án là con số mọi báo cáo lãi lỗ dùng. Khi đã chốt, mở báo giá gửi khách, bấm <span class="ui">Đẩy giá bán vào dự án</span> (hoặc <span class="ui">Đẩy giá bán</span> trên thẻ dự toán) và xác nhận.</p>
        <h5>Hồ sơ & phiên bản</h5>
        <ol class="steps">
          <li>Trang dự án › khung <b>Hồ sơ & phiên bản</b>: chọn loại <b>Báo giá</b> hoặc <b>Hợp đồng</b>, nhập phiên bản (R0, R1…), ngày gửi, trạng thái, ghi chú, bấm <span class="ui">Thêm phiên bản</span>.</li>
          <li>Khi gửi bản mới, chuyển bản cũ sang <b>Bị thay thế</b>; bản khách đồng ý đặt <b>Được duyệt</b>.</li>
        </ol>
      </div>
    </section>

    <!-- ================= KỸ THUẬT ================= -->
    <section class="part" id="kt">
      <h2>Phòng Kỹ thuật <span class="role-tag">vai trò Kỹ thuật / Thiết kế</span></h2>
      <p class="part-lede">Giữ thông tin kỹ thuật của dự án, mốc tiến độ từ bản vẽ tới hồ sơ quyết toán, và nhật ký công trường.</p>

      <div class="task" id="kt-du-an">
        <h3>Cập nhật thông tin dự án</h3>
        <p class="where"><span class="path">Dự án</span> › bấm mã dự án</p>
        <ol class="steps">
          <li>Dải trạng thái trên đầu trang: bấm để chuyển <b>Chờ → Shop → Gia công → Lắp dựng → Hoàn thành</b>.</li>
          <li>Khung <b>Thông tin dự án</b>: vị trí, kích thước K×L×H, diện tích, ngày bắt đầu, ngày hoàn thành, người phụ trách.</li>
          <li>Khung <b>Nhà cung cấp theo hạng mục</b>: chọn NCC cho BL neo, KCT, Xà gồ, BLLK, Tôn, và đội lắp dựng.</li>
        </ol>
      </div>

      <div class="task" id="kt-tien-do">
        <h3>Mốc tiến độ và Gantt</h3>
        <p class="where">Trang dự án › Tiến độ thực hiện · <span class="path">Tiến độ › Theo tuần</span> · <span class="path">Tiến độ › Gantt</span></p>
        <ol class="steps">
          <li>Tám mốc cố định: Bản vẽ KT · Shop · Mua hàng · Gia công · Lắp dựng · Lợp tôn · HS nghiệm thu · HS quyết toán.</li>
          <li>Mỗi mốc điền ngày <b>Kế hoạch</b> ngay khi có tiến độ tổng. Khi xong, điền ngày <b>Thực tế</b>, tích <b>Xong</b>, bấm <span class="ui">Lưu</span> ở dòng đó.</li>
          <li>Luôn điền ngày thực tế khi tích xong — báo cáo theo kỳ xếp mốc vào tháng theo ngày này; thiếu ngày thì mốc không được đếm.</li>
          <li><span class="path">Tiến độ › Theo tuần</span> xem nhanh mọi dự án: số mốc đã xong / 8, ghi chú mới nhất. <span class="path">Tiến độ › Gantt</span> xem kế hoạch trên trục thời gian.</li>
        </ol>
        <p class="tip"><b>Mốc trễ được nhắc tự động.</b>Mốc chưa xong mà quá ngày kế hoạch sẽ vào bản tin nhắc việc 8 giờ sáng.</p>
      </div>

      <div class="task" id="kt-nhat-ky">
        <h3>Nhật ký công trường và shopdrawing</h3>
        <p class="where">Trang dự án › Nhật ký dự án · Hồ sơ & phiên bản · nút <span class="ui">Nhập nhanh</span></p>
        <ul class="bul">
          <li><b>Nhật ký:</b> gõ tiến độ, vướng mắc, chỉ đạo, chọn ảnh đính kèm, bấm <span class="ui">Thêm ghi chú</span>. Giờ và tên người ghi tự lưu; ghi chú mới nhất hiện ở <span class="path">Tiến độ › Theo tuần</span>.</li>
          <li><b>Ở công trường:</b> bấm <span class="ui">Nhập nhanh</span> → chọn dự án → tab <b>Tiến độ / nhật ký</b> → gõ “Đã lắp xong khung trục 1–5…”, bấm <span class="ui">Chụp / thêm ảnh</span> nếu cần → <span class="ui">Lưu tiến độ</span>.</li>
          <li><b>Shopdrawing:</b> khung Hồ sơ & phiên bản, loại <b>Shopdrawing</b>, phiên bản Rev0, Rev1…, trạng thái Nháp / Đã gửi / Được duyệt / Bị thay thế.</li>
        </ul>
      </div>

      <div class="task" id="kt-tra-cuu">
        <h3>Tra cứu thép và bóc khối lượng</h3>
        <p class="where"><span class="path">Tiện ích › Tra cứu & Bóc KL</span></p>
        <ol class="steps">
          <li>Ô tìm nhanh: gõ quy cách <b>I300</b>, <b>V50x5</b>, <b>Ø16</b>, <b>40x80x1.4</b> để ra kg/m, tiết diện (cm²), kg/cây.</li>
          <li>Bấm một mã thép để mở <b>Máy tính nhanh</b>: nhập chiều dài mỗi thanh (m) × số thanh → khối lượng kg.</li>
          <li>Phần bóc khối lượng: chọn dự án, thêm cấu kiện theo loại — bê tông (móng / cột / dầm / sàn), thép hình tra bảng, thép tổ hợp I hàn (cánh, bụng, dày, dài), bản mã. App cộng BT (m³), ván khuôn (m²), thép (kg).</li>
        </ol>
      </div>
    </section>

    <!-- ================= VẬT TƯ ================= -->
    <section class="part" id="vt">
      <h2>Phòng Vật tư <span class="role-tag">vai trò Vật tư / Mua hàng</span></h2>
      <p class="part-lede">Biến dự toán chào giá thành dự toán thi công có nhà cung cấp, rồi đặt hàng và theo dõi nhận hàng.</p>

      <div class="task" id="vt-du-toan">
        <h3>Lập dự toán thi công</h3>
        <p class="where">Trang dự án › <span class="ui">Mở dự toán</span> · hoặc <span class="path">Dự toán thi công & chi phí</span> › bấm dự án</p>
        <h5>Cách 1 — đổ từ dự toán chào giá (nên dùng)</h5>
        <ol class="steps">
          <li>Bấm <span class="ui">Đổ từ dự toán chào giá</span>, chọn bản dự toán chào giá của dự án.</li>
          <li>Xem trước: các hạng mục sẽ tạo, số dòng. Dòng được gộp theo <b>nhóm chi phí</b> (kết cấu thép, xà gồ, tôn, bulong…), tên dùng tên gọn.</li>
          <li>Bấm <span class="ui">Đổ xuống</span>. App <b>chỉ thêm mới</b>, không xoá hay thay dòng đã có — dự án đã có dự toán thì đọc kỹ cảnh báo, tránh đổ hai lần.</li>
        </ol>
        <h5>Cách 2 — từ mẫu hoặc gõ tay</h5>
        <ul class="bul">
          <li><span class="ui">Thêm hạng mục từ mẫu</span>: chọn một phần của bộ hạng mục chuẩn, đặt tên (“Khung mái nhà A”), nhập khối lượng; các dòng “tự tính” được suy ra.</li>
          <li><span class="ui">Thêm dòng</span>: chọn <b>Nhóm</b>, tên, đơn vị, <b>KL thiết kế</b>, <b>KL thực tế</b>, đơn giá, nhà cung cấp, trạng thái đặt hàng / xuất hàng.</li>
        </ul>
        <h5>Sửa hằng ngày</h5>
        <ul class="bul">
          <li>Khối lượng và đơn giá sửa ngay trên bảng. Ô khối lượng sửa <b>KL thực tế</b> nếu đã có, không thì sửa KL thiết kế.</li>
          <li>Bấm vào tên dòng để đổi tên hoặc <b>chọn công việc khác</b> trong thư viện: đơn giá lấy theo khu vực của dự án, thành tiền tính lại; khối lượng, nhà cung cấp, trạng thái giữ nguyên.</li>
          <li>Nút bút cuối dòng: nhà cung cấp (NCC trong khu vực dự án xếp lên đầu), đặt hàng, xuất hàng, ghi chú.</li>
          <li>Khung bên phải: tổng chi phí, giá bán, lợi nhuận, biên lợi nhuận, chi phí / m², chi phí theo nhóm. <span class="ui">Xuất Excel</span> để gửi NCC hoặc lưu hồ sơ.</li>
        </ul>
      </div>

      <div class="task" id="vt-bang-boc">
        <h3>Gắn bảng bóc khối lượng từ Excel</h3>
        <p class="where">Dự toán thi công › nút bảng ▤ ở cuối dòng</p>
        <ol class="steps">
          <li>Bấm nút bảng ▤ ở dòng cần bóc (ví dụ “Thép tổ hợp cột kèo”).</li>
          <li><span class="ui">Chọn file Excel</span>: bảng thống kê kết cấu, hoặc bảng bóc tôn theo trục. App tự nhận định dạng và hiện từng dòng: nhóm, mã, quy cách, dài (mm), khối lượng đơn.</li>
          <li>Kiểm tra tổng, bấm <span class="ui">Xác nhận & đặt khối lượng</span>. KL thiết kế của dòng thành tổng bảng bóc và bị khoá (dấu ▤).</li>
          <li>Bản vẽ đổi: nạp lại file mới. Muốn nhập tay trở lại: <span class="ui">Gỡ bảng bóc</span>.</li>
        </ol>
      </div>

      <div class="task" id="vt-don-hang">
        <h3>Đề xuất, đặt hàng và nhận hàng</h3>
        <p class="where"><span class="path">Phê duyệt</span> · trang dự án › <span class="ui">Mở đơn hàng</span></p>
        <ol class="steps">
          <li>Đơn cần duyệt: vào <span class="path">Phê duyệt</span>, loại <b>Mua hàng / vật tư</b>, gắn dự án, số tiền, nội dung (hạng mục, lý do, nhà cung cấp), bấm <span class="ui">Gửi đề xuất</span>. Còn “Chờ duyệt” thì bạn xoá được.</li>
          <li>Được duyệt: mở đơn hàng của dự án, bấm <span class="ui">Thêm đơn hàng</span>: số / tên đơn, loại đơn (Kết cấu thép, Xà gồ, Tôn, Vật tư phụ), nhà cung cấp, ngày đặt, dự kiến giao, đường dẫn file đơn.</li>
          <li>Thêm vật tư vào đơn: loại (sheet), hạng mục, tên hàng & quy cách, đơn vị, số lượng, đơn giá, trọng lượng (kg). Thành tiền để trống thì app tự nhân.</li>
          <li>Có hình biên dạng (máng, diềm): bấm <span class="ui">Thêm ảnh biên dạng</span> ở dòng vật tư.</li>
          <li>Chuyển trạng thái <b>Nháp → Đã đặt → Đã nhận</b>; điền <b>Ngày nhận</b> khi hàng về.</li>
          <li>Xem theo <b>Gom theo: Nhóm vật tư</b> hoặc <b>Hạng mục</b> để đối chiếu với dự toán. Đơn nhanh ngoài công trường: <span class="ui">Nhập nhanh</span> › Đơn hàng / vật tư, hoặc dán nhiều dòng từ Excel.</li>
        </ol>
      </div>

      <div class="task" id="vt-ncc">
        <h3>Danh bạ nhà cung cấp</h3>
        <p class="where"><span class="path">Chủ đầu tư & NCC › Nhà cung cấp</span></p>
        <ul class="bul">
          <li>Thêm / sửa NCC: <b>Tên NCC</b>, <b>Loại NCC</b> (Kết cấu thép, Xà gồ, Tôn, Bulong neo, Bulong liên kết, Lắp dựng, Khác), người phụ trách, điện thoại, ghi chú.</li>
          <li>Giá mua theo NCC và khu vực phục vụ do Ban giám đốc ghi trong Thư viện; gửi báo giá mới của NCC cho BGĐ để cập nhật.</li>
        </ul>
      </div>
    </section>

    <!-- ================= KẾ TOÁN ================= -->
    <section class="part" id="ke-toan">
      <h2>Phòng Kế toán <span class="role-tag">vai trò Kế toán / Tài chính</span></h2>
      <p class="part-lede">Ghi đúng ngày tiền thật vào, tiền thật ra. Công nợ và báo cáo theo kỳ đều đọc từ đây.</p>

      <div class="task" id="kt2-dot">
        <h3>Thu – chi theo đợt của từng dự án</h3>
        <p class="where">Trang dự án › Thanh toán theo đợt</p>
        <ol class="steps">
          <li>Khi hợp đồng ký: ở cột <b>THU — từ Chủ đầu tư</b>, bấm <span class="ui">+ Thêm đợt</span> cho từng đợt theo điều khoản (Tạm ứng, Đợt 2 sau lắp dựng…): tên đợt, số tiền, <b>hạn</b>.</li>
          <li>Tương tự cột <b>CHI — cho NCC / thầu phụ</b>: tên đợt, số tiền, hạn, tên NCC.</li>
          <li>Khi tiền về / tiền đi: ở đợt đó điền <b>ngày thực tế</b> và <b>số tiền thực tế</b> (để trống = đúng số kế hoạch), bấm <span class="ui">Đã thu</span> hoặc <span class="ui">Đã trả</span>. Không điền ngày thì app lấy ngày hôm nay.</li>
          <li>Đầu cột luôn hiện Kế hoạch · Thực tế · Còn lại.</li>
        </ol>
        <p class="warn"><b>Ngày thực tế quyết định báo cáo.</b>Báo cáo theo kỳ tính tiền theo ngày thực thu / thực trả, không theo hạn. Bấm “Đã thu” trễ vài ngày thì nhớ sửa lại ngày cho đúng ngày tiền về, kẻo khoản đó rơi sai tháng.</p>
        <p>Nhiều đợt cùng lúc: <span class="ui">Nhập nhanh</span> › Chi phí / thanh toán › dán bảng từ Excel theo cột Thu/Chi · Tên đợt · Số tiền · Hạn (yyyy-mm-dd) · CĐT / NCC · Ghi chú.</p>
      </div>

      <div class="task" id="kt2-cong-no">
        <h3>Công nợ phải thu, phải trả</h3>
        <p class="where"><span class="path">Công nợ</span></p>
        <ul class="bul">
          <li>Ba số đầu trang: còn phải thu (chủ đầu tư), còn phải trả (NCC), chênh lệch.</li>
          <li><b>Phải thu theo chủ đầu tư</b>: giá trị hợp đồng, đã thu, còn phải thu, số dự án. <b>Phải trả theo NCC</b>: từ đơn hàng và đợt chi.</li>
          <li>Số liệu lấy từ quyết toán, hợp đồng và đơn hàng — sai ở đây thì sửa ở nguồn (đợt thanh toán, hợp đồng, đơn hàng), không có ô nhập tay.</li>
          <li>Đợt quá hạn và đợt tới hạn trong 7 ngày có trong bản tin nhắc việc buổi sáng.</li>
        </ul>
      </div>

      <div class="task" id="kt2-chi-phi">
        <h3>Quyết toán chi phí và báo cáo theo kỳ</h3>
        <p class="where"><span class="path">Chi phí & báo cáo › Tổng hợp</span> · <span class="path">Chi phí & báo cáo › Theo kỳ</span></p>
        <ol class="steps">
          <li><b>Tổng hợp</b>: doanh thu, chi phí, lợi nhuận trước thuế, biên lợi nhuận, còn phải thu của từng dự án đã quyết toán. Bấm dự án để xem chi tiết theo nhóm A–K (Kết cấu thép, Xà gồ, Tôn – Diềm… Khác).</li>
          <li>Số liệu quyết toán nạp từ file quyết toán / sổ giá thành: gửi file cho Ban giám đốc nạp qua <span class="path">Tiện ích › Nhập từ Excel</span> (mỗi file một dự án).</li>
          <li><b>Theo kỳ</b>: chọn Tháng / Quý / Năm và kỳ cần xem — tiền đã thu, đã chi, dòng tiền ròng, hợp đồng ký mới, đơn hàng đặt, dự án khởi công / hoàn thành, so với kỳ trước.</li>
          <li>Ô nào bằng 0 bất thường: đọc dòng giải thích “Vì sao vài ô bên dưới bằng 0” — thường do thiếu ngày thực tế.</li>
        </ol>
      </div>
    </section>

    <footer>
      Sổ tay viết theo app ở phiên bản ngày 14/09/2026. Gặp chỗ app khác với hướng dẫn, hoặc cần quyền mới, báo Ban giám đốc / Quản lý.
    </footer>
  </main>
`;
