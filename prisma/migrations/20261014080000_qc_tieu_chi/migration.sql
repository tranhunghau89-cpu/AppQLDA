-- Tiêu chí con cho từng mục QC (mỗi dòng một ý). Mục dự án chép từ mẫu lúc tạo.
ALTER TABLE "QcMau" ADD COLUMN "tieuChi" TEXT;
ALTER TABLE "QcMuc" ADD COLUMN "tieuChi" TEXT;

-- Bộ tiêu chí gợi ý cho các mục mẫu đang có (theo id; mục không còn thì bỏ qua).
UPDATE "QcMau" AS m SET "tieuChi" = v.tc FROM (VALUES
  -- Bản vẽ KT
  ('qcmau_01', E'Có đủ mặt bằng tổng thể, mặt bằng định vị móng / bu lông neo\nCó mặt đứng các trục, mặt cắt ngang và dọc nhà\nCó bản vẽ kết cấu móng: kích thước, cốt thép, cao độ đáy / đỉnh móng\nCó bản vẽ khung: cột, kèo, xà gồ, giằng mái, giằng cột\nCó chi tiết liên kết chính: chân cột, đỉnh cột, nối kèo, đỉnh kèo\nKhung tên đủ: tên công trình, số hiệu, ngày, người vẽ / kiểm / duyệt'),
  ('qcmau_02', E'Danh mục hạng mục trên bản vẽ trùng phụ lục hợp đồng (không thiếu, không thừa)\nKích thước K × L × H, khẩu độ, bước cột đúng hợp đồng\nDiện tích xây dựng / mái tính từ bản vẽ khớp diện tích hợp đồng\nHạng mục phát sinh (nếu có) đã ghi rõ và có xác nhận của CĐT\nKhối lượng chính (thép, tôn) ước từ bản vẽ không vượt dự toán bất thường'),
  ('qcmau_03', E'Ghi rõ tiêu chuẩn áp dụng (TCVN 2737, TCVN 5575 hoặc tương đương)\nGhi tải trọng mái: tĩnh tải, hoạt tải, tải treo (quạt, đèn, ống, pin mặt trời nếu có)\nGhi vùng gió, dạng địa hình, áp lực gió tính toán theo địa điểm công trình\nTải cầu trục / sàn lửng (nếu có) ghi rõ sức nâng, vị trí\nMác thép, cấp bền bu lông, que hàn ghi trong ghi chú chung'),
  ('qcmau_04', E'Gửi bộ bản vẽ bản mới nhất (đúng số phiên bản) cho CĐT\nCó xác nhận bằng chữ ký trên bản vẽ, biên bản hoặc email / Zalo phản hồi đồng ý\nÝ kiến sửa của CĐT (nếu có) đã cập nhật và gửi lại\nLưu bản đã xác nhận vào hồ sơ dự án (đính kèm làm bằng chứng)'),
  ('cmv7dddjm0000lb061xza2nmy', E'Chủng loại thép cột, kèo, xà gồ (mác, độ dày, tiết diện) đúng hợp đồng\nTôn mái / vách: loại, độ dày, lớp mạ, màu đúng hợp đồng\nSơn: hệ sơn, số lớp, màu đúng hợp đồng\nBu lông, phụ kiện, vật liệu cách nhiệt (nếu có) đúng quy cách hợp đồng\nKhông có vật tư thay thế khi chưa có xác nhận của CĐT'),
  ('cmv7dg2q30002if06txkrra8b', E'Có ảnh / video hiện trạng mặt bằng, lối vào, công trình lân cận\nĐo và ghi kích thước thực tế khu đất, vị trí móng / kết cấu cũ (nếu cải tạo)\nGhi rõ chướng ngại: điện trung thế, cây, mương, công trình ngầm\nGhi điều kiện thi công: đường cho xe cẩu / xe tải vào, giờ được thi công, điện nước\nCĐT đã cung cấp / xác nhận thông tin hiện trạng'),
  ('cmv7ddz0w0002lb06kjjip57m', E'Vị trí công trình trên bản vẽ khớp mốc giới, ranh đất thực tế\nCao độ nền, cao độ móng phù hợp hiện trạng (thoát nước, nền xung quanh)\nPhương án kết nối với công trình cũ (nếu có) đã kiểm tra tại chỗ\nPhương án cẩu lắp, vận chuyển khả thi với mặt bằng thực tế\nCác điểm vướng (cột điện, cây, mái lân cận) đã có phương án xử lý'),
  -- Shop
  ('qcmau_05', E'Khẩu độ, bước khung, số gian đúng hợp đồng / bản vẽ KT\nCao độ đỉnh cột, chiều cao thông thủy đúng\nĐộ dốc mái đúng (theo % hoặc độ)\nVị trí cửa, ô thoáng, mái hắt, sàn lửng (nếu có) đúng\nTim trục và kích thước tổng khớp mặt bằng móng'),
  ('qcmau_06', E'Tiết diện và độ dày bản bụng / bản cánh cột, kèo đúng hợp đồng\nXà gồ: loại (C/Z), kích thước, độ dày, mạ kẽm đúng hợp đồng\nTôn: loại sóng, độ dày, lớp mạ, màu đúng hợp đồng\nMác thép ghi trên shop đúng mác hợp đồng\nĐối chiếu bảng so sánh vật tư HĐ – shop trên app không còn dòng lệch'),
  ('qcmau_07', E'BOQ xuất từ shop có đủ: cấu kiện, tiết diện, số lượng, khối lượng\nTổng khối lượng thép khớp dự toán (lệch > 5% phải giải trình)\nKhối lượng tôn, xà gồ, bu lông khớp dự toán\nCác dòng phát sinh so với dự toán đã đánh dấu và báo QL'),
  ('qcmau_08', E'Gửi CĐT bộ shop drawing bản cuối (đúng phiên bản)\nCó chữ ký duyệt trên bản vẽ, biên bản hoặc email / Zalo xác nhận\nÝ kiến sửa (nếu có) đã cập nhật trước khi ra gia công\nĐính kèm bằng chứng duyệt vào mục này'),
  ('cmv7dbu870000if06d755n3rh', E'Chi tiết liên kết (chân cột, đỉnh cột, nối kèo) đúng thiết kế\nSố lượng, đường kính, cấp bền bu lông đúng thiết kế\nKích thước đường hàn, sườn tăng cứng thể hiện đủ\nHệ giằng mái, giằng cột, thanh chống đúng vị trí thiết kế\nChi tiết diềm, máng xối, ống thoát nước mái đúng cấu tạo'),
  -- Mua hàng
  ('qcmau_09', E'Mác thép, tiết diện, độ dày trong đơn hàng đúng hợp đồng\nLoại tôn, xà gồ, bu lông, phụ kiện đúng hợp đồng\nNhà sản xuất / thương hiệu đúng cam kết (nếu HĐ có chỉ định)\nĐối chiếu bảng so sánh vật tư HĐ – đơn hàng trên app không còn dòng lệch'),
  ('qcmau_10', E'Mã màu tôn ghi trong đơn hàng trùng mã màu hợp đồng\nMã màu sơn / hệ sơn trong đơn hàng trùng hợp đồng\nTôn diềm, máng xối cùng mã màu với tôn mái / vách\nĐã gửi CĐT xác nhận mẫu màu (nếu HĐ yêu cầu)'),
  ('qcmau_11', E'Khối lượng đặt từng loại so với BOQ shop\nHao hụt cộng thêm trong định mức (thép ≤ 3%, tôn theo chiều dài cắt)\nChiều dài tôn đặt theo bảng cắt shop, không đặt chung chung\nPhần dư / thiếu so với BOQ đã ghi lý do'),
  ('qcmau_12', E'Đơn giá đặt hàng không vượt đơn giá dự toán / thư viện đơn giá\nNCC nằm trong danh sách NCC đã duyệt\nĐơn hàng đã được BGĐ / QL phê duyệt trên app\nĐiều kiện giao hàng, thanh toán ghi rõ trong đơn'),
  -- Gia công
  ('qcmau_13', E'Kiểm số lượng, chủng loại, độ dày (đo thước kẹp) khi nhập kho\nCó CO/CQ của lô hàng, mác thép trên CQ đúng đơn hàng\nThép không cong vênh, rỉ sét nặng, rỗ bề mặt\nTôn đúng màu, không trầy xước, móp méo\nLập phiếu nhập kho và lưu CO/CQ vào hồ sơ'),
  ('qcmau_14', E'Kiểm tối thiểu 10% số cấu kiện mỗi loại (cột, kèo)\nChiều dài, chiều cao tiết diện, độ dày bản đúng shop (dung sai ±2 mm)\nVị trí, đường kính lỗ bu lông đúng shop (lắp thử bản mã nếu được)\nĐộ cong / vặn cấu kiện trong giới hạn (≤ L/1000)\nGhi số liệu đo vào biên bản / ảnh chụp thước đo'),
  ('qcmau_15', E'Chiều cao đường hàn đúng shop (đo bằng thước đo mối hàn)\nĐường hàn liên tục, đủ chiều dài, không bỏ sót\nKhông rỗ khí, nứt, cháy cạnh, lẹm chân, ngậm xỉ\nĐã gõ xỉ, mài vệ sinh mối hàn trước khi sơn\nMối hàn liên kết chính (chân cột, nối kèo) kiểm 100%'),
  ('qcmau_16', E'Bề mặt đã làm sạch rỉ, dầu mỡ trước khi sơn\nMàu sơn đúng mã màu hợp đồng\nĐủ số lớp: lót + phủ theo hợp đồng\nĐộ dày màng sơn khô đạt yêu cầu (đo máy, ghi số liệu)\nSơn đều, không bong tróc, chảy sơn, sót mép / góc khuất'),
  -- Lắp dựng
  ('qcmau_17', E'Có biên bản bàn giao mặt bằng ký với CĐT\nKiểm tim trục, khoảng cách trục bằng máy toàn đạc / thước thép\nCao độ đỉnh móng, mặt bản đế đồng đều (lệch ≤ ±5 mm)\nVị trí, cao độ bu lông neo đúng bản vẽ (lệch ≤ ±3 mm)\nGhi các sai lệch và phương án xử lý trước khi dựng'),
  ('qcmau_18', E'Có kế hoạch / biện pháp an toàn được phổ biến cho tổ đội\nCẩu, xe nâng có giấy kiểm định còn hạn; người vận hành có chứng chỉ\nCông nhân đủ dây an toàn, mũ, giày; có dây cứu sinh trên cao\nKhu vực cẩu lắp có rào chắn, biển cảnh báo\nCó danh sách công nhân và cam kết an toàn'),
  ('qcmau_19', E'Đo độ thẳng đứng cột bằng máy / dây dọi (lệch ≤ H/1000, tối đa 10 mm)\nKhoảng cách tim cột, đỉnh cột đúng bản vẽ\nĐộ võng kèo, độ dốc mái đúng thiết kế\nĐã căn chỉnh xong trước khi siết hoàn thiện bu lông và đổ vữa chân cột\nGhi số liệu đo từng trục vào biên bản'),
  ('qcmau_20', E'Đủ số lượng bu lông tại mọi liên kết, đúng đường kính và cấp bền\nSiết đúng lực (cờ lê lực) với liên kết chính; đánh dấu bu lông đã siết\nĐủ long đen, ê cu; ren thừa ≥ 2 bước ren\nBản mã áp sát, không hở khe ở mặt bích\nBu lông neo chân cột đã siết và có ê cu hãm (nếu thiết kế yêu cầu)'),
  -- Lợp tôn
  ('qcmau_21', E'Đo độ dày tôn thực tế (thước kẹp / panme) đúng hợp đồng\nNhãn in trên tôn (thương hiệu, độ dày, lớp mạ) đúng hợp đồng\nMàu tôn đúng mã màu, đồng đều giữa các lô\nĐối chiếu bảng so sánh vật tư HĐ – thực tế trên app không còn dòng lệch'),
  ('qcmau_22', E'Vít đủ mật độ, đúng loại, có long đen cao su, bắn vuông góc không quá chặt\nĐộ chồng mí tôn đúng (dọc ≥ 1 sóng, ngang ≥ 150–200 mm)\nDiềm, úp nóc, máng xối, ống thoát lắp đủ và đúng vị trí\nMáng xối đủ độ dốc, các mối nối được trám kín\nĐã vệ sinh mạt sắt, phôi vít trên mái'),
  ('qcmau_23', E'Kiểm tra sau mưa hoặc thử xịt nước tại các vị trí nghi ngờ\nKiểm các điểm xung yếu: vít, chồng mí, úp nóc, máng xối, lỗ xuyên mái\nKhông có vị trí đọng nước trên mái\nĐiểm dột / thấm (nếu có) đã xử lý và kiểm lại\nChụp ảnh kết quả kiểm tra đính kèm'),
  -- Hồ sơ nghiệm thu
  ('qcmau_24', E'Có biên bản nghiệm thu móng / bàn giao mặt bằng\nCó biên bản nghiệm thu vật liệu đầu vào\nCó biên bản nghiệm thu lắp dựng khung\nCó biên bản nghiệm thu lợp tôn, phụ kiện\nCó biên bản nghiệm thu hoàn thành bàn giao đưa vào sử dụng\nĐủ chữ ký các bên trên từng biên bản'),
  ('qcmau_25', E'Ghi đủ các ngày thi công, không bỏ trống\nGhi nhân lực, thiết bị, thời tiết, khối lượng làm trong ngày\nGhi sự cố, thay đổi, yêu cầu của CĐT (nếu có)\nCó chữ ký cán bộ kỹ thuật / giám sát'),
  ('qcmau_26', E'Thể hiện đúng hiện trạng đã thi công (kích thước, vị trí, chủng loại)\nGhi rõ các thay đổi so với thiết kế / shop\nCó khung tên, chữ ký người lập và xác nhận của CĐT\nBản cứng và bản mềm (PDF) lưu trên app'),
  ('qcmau_27', E'Có CO/CQ thép kết cấu, xà gồ\nCó CO/CQ tôn lợp\nCó CO/CQ / phiếu xuất xưởng bu lông, sơn\nCO/CQ khớp với vật tư thực tế đã dùng (mác, lô hàng)'),
  -- Hồ sơ quyết toán
  ('qcmau_28', E'Khối lượng quyết toán tính theo bản vẽ hoàn công\nPhát sinh tăng / giảm có biên bản xác nhận của CĐT\nĐơn giá áp đúng hợp đồng và phụ lục\nTổng giá trị quyết toán đã được QL kiểm tra'),
  ('qcmau_29', E'Mỗi đợt thanh toán có đề nghị thanh toán, biên bản xác nhận khối lượng\nCó hoá đơn GTGT đúng giá trị từng đợt\nCó chứng từ thu tiền (sao kê / phiếu thu) khớp số tiền\nSố đã thu trên app khớp chứng từ'),
  ('qcmau_30', E'Lập biên bản đối chiếu công nợ: giá trị HĐ + phát sinh, đã thu, còn lại\nSố liệu khớp với số liệu công nợ trên app\nCĐT đã ký / đóng dấu biên bản đối chiếu\nĐính kèm bản ký vào mục này')
) AS v(id, tc)
WHERE m."id" = v.id;

-- Dự án đã tạo QC trước đây: nhận tiêu chí từ mẫu nếu nội dung mục còn y như mẫu.
UPDATE "QcMuc" AS q SET "tieuChi" = m."tieuChi"
FROM "QcMau" AS m
WHERE q."tieuChi" IS NULL AND m."tieuChi" IS NOT NULL
  AND q."giaiDoan" = m."giaiDoan" AND q."noiDung" = m."noiDung";
