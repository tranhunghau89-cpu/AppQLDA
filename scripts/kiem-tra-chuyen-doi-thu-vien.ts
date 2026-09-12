/**
 * Đối soát sau khi chuyển WorkPrice sang thư viện mới. CHỈ ĐỌC — không ghi gì.
 *
 * Chạy: npx tsx scripts/kiem-tra-chuyen-doi-thu-vien.ts
 *
 * Ba câu hỏi phải trả lời được trước khi tin vào dữ liệu mới:
 *   1. Có mất công tác nào không?
 *   2. Tổng tiền đơn giá có khớp không?
 *   3. Có dòng báo giá nào mất đường về danh mục không?
 *
 * Và một câu hỏi phải trả lời được sau MỌI lần triển khai: 516 dòng dự toán thi công
 * còn nguyên chứ?
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const XANH = "✓";
const DO = "✗";
let hong = 0;

function kiem(ten: string, dat: boolean, chiTiet: string) {
  if (!dat) hong++;
  console.log(`${dat ? XANH : DO} ${ten}: ${chiTiet}`);
}

function gan(a: number, b: number): boolean {
  // Cộng dồn số thực nên đừng so bằng tuyệt đối; lệch dưới một đồng là làm tròn.
  return Math.abs(a - b) < 1;
}

async function main() {
  const [soWorkPrice, soCongTac, soDonGia, soEstimateItem] = await Promise.all([
    db.workPrice.count(),
    db.congTac.count(),
    db.donGiaCongTac.count(),
    db.estimateItem.count(),
  ]);

  kiem(
    "Số công tác",
    soCongTac >= soWorkPrice,
    `WorkPrice ${soWorkPrice} → CongTac ${soCongTac}`
  );
  kiem(
    "Số bản giá",
    soDonGia >= soWorkPrice,
    `${soDonGia} bản giá cho ${soCongTac} công tác`
  );

  // Tổng tiền: chỉ cộng bản giá chuyển đổi, vì bản nhập tay sau này làm lệch tổng
  // một cách hợp lệ và không nói gì về chất lượng chuyển đổi.
  const [tongCu, tongMoi] = await Promise.all([
    db.workPrice.aggregate({ _sum: { baseCost: true } }),
    db.donGiaCongTac.aggregate({
      where: { nguon: "CHUYEN_DOI" },
      _sum: { donGia: true },
    }),
  ]);
  const a = tongCu._sum.baseCost ?? 0;
  const b = tongMoi._sum.donGia ?? 0;
  kiem("Tổng đơn giá", gan(a, b), `WorkPrice ${a} vs CHUYEN_DOI ${b}`);

  // Mọi mã đang được báo giá dùng phải tra ngược được về danh mục mới.
  const maDangDung = await db.quoteItem.findMany({
    where: { workCode: { not: null } },
    select: { workCode: true },
    distinct: ["workCode"],
  });
  const maTrongThuVien = new Set(
    (await db.congTac.findMany({ select: { ma: true } })).map((c) => c.ma)
  );
  const macMo = maDangDung
    .map((m) => m.workCode!)
    .filter((ma) => !maTrongThuVien.has(ma));
  kiem(
    "Mã trong báo giá tra được về thư viện",
    macMo.length === 0,
    macMo.length === 0
      ? `${maDangDung.length} mã, khớp hết`
      : `mất đường về: ${macMo.join(", ")}`
  );

  // Ràng buộc cứng của cả kế hoạch: dự toán thi công không được đụng tới.
  //
  // Đếm dòng CŨ chứ không đếm tổng. Từ khi có nút "Đổ xuống dự toán thi công", bảng
  // này lớn lên là chuyện đúng — chốt tổng bằng 516 sẽ làm phép kiểm đỏ ngay lần đầu
  // tính năng chạy thành công, mà một phép kiểm đỏ lúc chạy đúng còn tệ hơn không có.
  // Dòng cũ nhận diện bằng chỗ trống: chúng nhập từ Excel nên không mang xuất xứ thư
  // viện nào; dòng đổ xuống thì có.
  //
  // Con số 516 là của CƠ SỞ DỮ LIỆU THẬT, bản nháp chỉ cần khẳng định bảng chưa bị xóa.
  const soDongCu = await db.estimateItem.count({
    where: { congTacId: null, donGiaId: null, khuVucId: null },
  });
  const laThat = !(process.env.DATABASE_URL ?? "").includes("127.0.0.1");
  if (laThat) {
    kiem(
      "Dự toán thi công còn nguyên",
      soDongCu >= 516,
      `${soDongCu} dòng cũ (CSDL thật, mong đợi ≥ 516) · tổng ${soEstimateItem} dòng`
    );
  } else {
    kiem(
      "Dự toán thi công không bị xóa",
      soEstimateItem > 0,
      `EstimateItem = ${soEstimateItem} (CSDL nháp)`
    );
  }

  // Công tác chưa có giá thì không sai, nhưng phải biết để còn đi nhập.
  const chuaCoGia = await db.congTac.count({ where: { donGia: { none: {} } } });
  console.log(
    `  ${chuaCoGia} công tác chưa có bản giá nào (không phải lỗi, nhưng cần nhập).`
  );

  console.log(hong === 0 ? `\n${XANH} Đối soát đạt.` : `\n${DO} ${hong} mục không đạt.`);
  process.exitCode = hong === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
