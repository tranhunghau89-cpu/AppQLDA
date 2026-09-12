/**
 * Gắn mã công tác thư viện cho các dòng của bộ hạng mục chuẩn.
 *
 * Chạy xem trước:  DATABASE_URL=... npx tsx scripts/gan-ma-cong-tac-bo-hang-muc.ts
 * Chạy ghi thật:   DATABASE_URL=... npx tsx scripts/gan-ma-cong-tac-bo-hang-muc.ts --ghi
 *
 * VÌ SAO LÀ BẢNG GÕ TAY CHỨ KHÔNG PHẢI THUẬT TOÁN GHÉP TÊN
 *
 * Đã thử ghép bằng đơn giá: 26/90 dòng khớp, và phần lớn là khớp NGẪU NHIÊN — "Keo"
 * 60.000 đ/chai đụng đúng giá "Co uPVC D110" 60.000 đ/cái, "Lợp tôn" 25.000 đ/m² đụng
 * đúng "Thi công tôn sàn". Một thuật toán cho ra những kết quả đó không kiểm chứng
 * được; một bảng gõ tay thì đọc được từng dòng và cãi được từng dòng.
 *
 * ĐÂY LÀ QUYẾT ĐỊNH VỀ TIỀN. Khi áp bộ vào dự toán, đơn giá lấy từ thư viện theo mã
 * này; `donGiaMacDinh` của bộ tụt xuống làm số dự phòng. Gắn nhầm mã là sai giá vốn
 * trên mọi dự toán về sau. Nên bảng dưới chỉ nhận hai loại dòng:
 *
 *   CHAC     — tên hoặc phần quyết định duy nhất một mã. "Lợp tôn" ở phần Mái là
 *              AK.210, ở phần Vách là AK.220, ở phần Sàn là AK.410. Không phải đoán.
 *   THEO_GIA — họ công tác chắc chắn, chỉ còn chọn quy cách, và chọn theo giá thư
 *              viện GẦN NHẤT với đơn giá mặc định của bộ. Đây là bằng chứng về việc bộ
 *              được soạn theo quy cách nào, không phải suy đoán suông.
 *
 * 44 dòng còn lại CỐ Ý để trống, ba lý do:
 *
 *   1. Khác THỨ NGUYÊN đơn vị. "Bulong liên kết" trong bộ tính theo kg, trong thư viện
 *      bán theo bộ; "Vận chuyển tôn" theo m² so với theo chuyến. Gắn vào là thay giá
 *      mỗi kg bằng giá mỗi bộ — sai gấp hàng chục lần chứ không phải sai chút ít.
 *   2. Hoà giữa hai quy cách. "Diềm" 68.000 đ nằm chính giữa AD.610 (58.000) và AD.620
 *      (78.000). Bốc một cái là bịa.
 *   3. Thư viện chưa có. "Phiễu thu", "Đai máng", "Keo" tính theo kg.
 *
 * Những dòng đó gắn bằng tay trên màn Bộ hạng mục chuẩn — ô mã công việc bấm được, và
 * hộp chọn bày sẵn đơn vị, giá thư viện, % lệch so với giá mặc định.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const GHI = process.argv.includes("--ghi");

/** Khoá: `phần | tên dòng | đơn vị`. Đơn vị nằm trong khoá vì "Keo" có hai dòng. */
type Muc = { ma: string; tin: "CHAC" | "THEO_GIA"; vi?: string };

const BANG: Record<string, Muc> = {
  // ----- A. Khung mái -----
  "A|Vật tư|bộ": { ma: "AB.140", tin: "THEO_GIA", vi: "nhóm bulong neo, đơn vị bộ; 80.000 gần AB.140 M22 (81.500)" },
  "A|Vận chuyển|chuyến": { ma: "AG.310", tin: "CHAC", vi: "mã vận chuyển bulong neo duy nhất" },
  "A|Lắp đặt|bộ": { ma: "AK.610", tin: "CHAC", vi: "lắp đặt bulong neo cos +0.000" },
  "A|Mã dưỡng|cái": { ma: "AB.210", tin: "THEO_GIA", vi: "80.000 gần AB.210 <400mm (65.000) hơn AB.220 (110.000)" },
  "A|Thép tổ hợp|kg": { ma: "AA.120", tin: "THEO_GIA", vi: "20.580 ≈ AA.120 Q345 (20.600)" },
  "A|Thép hình|kg": { ma: "AA.210", tin: "THEO_GIA", vi: "td<300mm là quy cách thường dùng" },
  "A|Xà gồ|kg": { ma: "AA.310", tin: "THEO_GIA", vi: "16.636 gần AA.310 Z80 (18.818) nhất" },
  "A|Ốc siết cáp|cái": { ma: "AC.820", tin: "THEO_GIA", vi: "9.800 ≈ AC.820 D16 (9.500)" },
  "A|Ecu giằng|cái": { ma: "AC.330", tin: "THEO_GIA", vi: "1.200 gần ecu M16 (1.350)" },
  "A|Vật tư máng|md": { ma: "AD.720", tin: "THEO_GIA", vi: "115.000 ≈ máng tôn <1200mm (118.000)" },
  "A|Vít|con": { ma: "AE.420", tin: "CHAC", vi: "phần mái → vít dài bắn tôn mái" },
  "A|Keo|chai": { ma: "AE.510", tin: "THEO_GIA", vi: "60.000 gần Silicon A300 (65.000)" },
  "A|Co, chếch|cái": { ma: "AE.720", tin: "THEO_GIA", vi: "63.000 ≈ co uPVC D110 (60.000)" },
  "A|Cầu chắn rác|cái": { ma: "AE.910", tin: "CHAC", vi: "trùng tên, trùng đơn vị" },
  "A|Lắp dựng KCT|kg": { ma: "AK.110", tin: "CHAC", vi: "1.800 đ/kg trùng khít AK.110" },
  "A|Lợp tôn|m2": { ma: "AK.210", tin: "CHAC", vi: "phần mái → lợp tôn mái" },

  // ----- B. Vách -----
  "B|Xà gồ|kg": { ma: "AA.310", tin: "THEO_GIA" },
  "B|Tôn nhựa|m2": { ma: "AD.510", tin: "THEO_GIA", vi: "156.600 ≈ tôn nhựa sáng 1,2mm (161.018)" },
  "B|Vít|con": { ma: "AE.430", tin: "CHAC", vi: "phần vách → vít ngắn bắn tôn vách" },
  "B|Keo|chai": { ma: "AE.510", tin: "THEO_GIA" },
  "B|Lắp dựng KCT|kg": { ma: "AK.110", tin: "CHAC" },
  "B|Lợp tôn|m2": { ma: "AK.220", tin: "CHAC", vi: "phần vách → lợp tôn vách" },

  // ----- C. Canopy -----
  "C|Thép tổ hợp|kg": { ma: "AA.120", tin: "THEO_GIA" },
  "C|Xà gồ|kg": { ma: "AA.310", tin: "THEO_GIA" },
  "C|Tôn vòm|m2": { ma: "AD.410", tin: "CHAC", vi: "109.080 ≈ tôn vòm 0,45mm (108.273)" },
  "C|Vít|con": { ma: "AE.420", tin: "CHAC", vi: "canopy lợp như mái" },
  "C|Keo|chai": { ma: "AE.510", tin: "THEO_GIA" },
  "C|Lắp dựng KCT|kg": { ma: "AK.110", tin: "CHAC" },
  "C|Lợp tôn|m2": { ma: "AK.210", tin: "CHAC" },

  // ----- D. Nóc gió -----
  "D|Thép hình|kg": { ma: "AA.210", tin: "THEO_GIA" },
  "D|Xà gồ|kg": { ma: "AA.310", tin: "THEO_GIA" },
  "D|Tôn vòm|m2": { ma: "AD.410", tin: "CHAC" },
  "D|Vít|con": { ma: "AE.420", tin: "CHAC" },
  "D|Keo|chai": { ma: "AE.510", tin: "THEO_GIA" },
  "D|Lắp dựng KCT|kg": { ma: "AK.110", tin: "CHAC" },
  "D|Lợp tôn|m2": { ma: "AK.210", tin: "CHAC" },

  // ----- E. Dầm sàn -----
  "E|Thép tổ hợp|kg": { ma: "AA.120", tin: "THEO_GIA" },
  "E|Thép hình|kg": { ma: "AA.210", tin: "THEO_GIA" },
  "E|Đinh chống cắt|bộ": { ma: "AF.220", tin: "THEO_GIA", vi: "7.000 gần D20 (6.500); thư viện đếm theo con" },
  "E|Ke bo sàn|md": { ma: "AF.320", tin: "CHAC", vi: "85.000 trùng khít thanh ke bo <450mm" },
  "E|Chống ke bo sàn|cái": { ma: "AF.330", tin: "CHAC", vi: "trùng tên, trùng đơn vị" },
  "E|Vít|con": { ma: "AE.410", tin: "CHAC", vi: "phần sàn → vít dài bắn tôn sàn" },
  "E|Lắp dựng KCT|kg": { ma: "AK.110", tin: "CHAC" },
  "E|Bắn đinh chống cắt|bộ": { ma: "AK.710", tin: "CHAC", vi: "7.500 trùng khít; thư viện đếm theo con" },
  "E|Lợp tôn|m2": { ma: "AK.410", tin: "CHAC", vi: "phần sàn → thi công tôn sàn, 25.000 trùng khít" },
  "E|Lắp phụ kiện|md": { ma: "AK.420", tin: "CHAC", vi: "phần sàn → thi công phụ kiện sàn" },
};

const tien = (v: number | null | undefined) =>
  v == null ? "—" : Math.round(v).toLocaleString("vi-VN");

async function main() {
  console.log("DATABASE_URL:", (process.env.DATABASE_URL ?? "").slice(0, 40));
  console.log(GHI ? "CHẾ ĐỘ: GHI THẬT\n" : "CHẾ ĐỘ: chỉ xem trước (thêm --ghi để ghi)\n");

  const congTac = await db.congTac.findMany({
    select: {
      id: true,
      ma: true,
      ten: true,
      donVi: true,
      donGia: {
        where: { khuVucId: null, congTacVatTuId: null },
        orderBy: { hieuLucTu: "desc" },
        take: 1,
        select: { donGia: true },
      },
    },
  });
  const theoMa = new Map(congTac.map((c) => [c.ma, c]));

  const thieu = [...new Set(Object.values(BANG).map((m) => m.ma))].filter((m) => !theoMa.has(m));
  if (thieu.length > 0) {
    console.error(`✗ Bảng ghép trỏ tới mã không có trong thư viện: ${thieu.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const dong = await db.boHangMucDong.findMany({
    select: {
      id: true,
      ten: true,
      donVi: true,
      donGiaMacDinh: true,
      maCongTac: true,
      congTacId: true,
      sortOrder: true,
      phan: { select: { ma: true, ten: true, sortOrder: true } },
    },
  });
  dong.sort((a, b) => (a.phan?.sortOrder ?? 0) - (b.phan?.sortOrder ?? 0) || a.sortOrder - b.sortOrder);

  // id cần ghi, gom theo công tác: một `updateMany` cho mỗi mã thay vì một `update`
  // cho mỗi dòng. 46 lệnh nối đuôi tới Supabase là ~15 giây, quá hạn giao dịch.
  const canGhi = new Map<string, string[]>();
  let daDung = 0;
  const boQua: typeof dong = [];

  console.log("PHẦN | DÒNG                       | ĐVT   | GIÁ BỘ     -> MÃ      GIÁ THƯ VIỆN  LỆCH  TIN");
  for (const d of dong) {
    const khoa = `${d.phan?.ma ?? "-"}|${d.ten}|${d.donVi ?? ""}`;
    const muc = BANG[khoa];
    if (!muc) {
      boQua.push(d);
      continue;
    }
    const ct = theoMa.get(muc.ma)!;
    const gia = ct.donGia[0]?.donGia ?? null;
    const lech =
      d.donGiaMacDinh && d.donGiaMacDinh > 0 && gia != null
        ? ((gia - d.donGiaMacDinh) / d.donGiaMacDinh) * 100
        : null;
    const canh = (ct.donVi ?? "") !== (d.donVi ?? "") ? ` ⚠ ĐVT thư viện: ${ct.donVi}` : "";
    console.log(
      `  ${d.phan?.ma}  | ${d.ten.padEnd(26)} | ${(d.donVi ?? "").padEnd(5)} | ` +
        `${tien(d.donGiaMacDinh).padStart(10)} -> ${muc.ma.padEnd(7)} ${tien(gia).padStart(11)}  ` +
        `${(lech == null ? "—" : `${lech > 0 ? "+" : ""}${lech.toFixed(0)}%`).padStart(5)}  ${muc.tin}${canh}`
    );

    if (d.congTacId === ct.id) daDung++;
    else {
      const ds = canGhi.get(ct.id);
      if (ds) ds.push(d.id);
      else canGhi.set(ct.id, [d.id]);
    }
  }

  const soGan = dong.length - boQua.length;
  console.log(`\n--- ${boQua.length} dòng CỐ Ý để trống (gắn tay trên giao diện) ---`);
  for (const d of boQua) {
    console.log(`  ${d.phan?.ma} | ${d.ten.padEnd(26)} | ${(d.donVi ?? "").padEnd(6)} | ${tien(d.donGiaMacDinh)}`);
  }

  console.log(
    `\nTổng ${dong.length} dòng · gắn mã ${soGan} · để trống ${boQua.length} · ` +
      `đã đúng sẵn ${daDung} · cần ghi ${soGan - daDung}`
  );

  if (!GHI) {
    console.log("\nChưa ghi gì. Thêm --ghi để áp vào cơ sở dữ liệu.");
    return;
  }

  const t0 = Date.now();
  const theoId = new Map(congTac.map((c) => [c.id, c.ma]));
  await Promise.all(
    [...canGhi].map(([congTacId, ids]) =>
      db.boHangMucDong.updateMany({
        where: { id: { in: ids } },
        // Biến thể thuộc về công tác cũ — đổi công tác thì phải gỡ.
        data: { congTacId, maCongTac: theoId.get(congTacId)!, congTacVatTuId: null },
      })
    )
  );
  console.log(`\n✓ Đã ghi ${soGan - daDung} dòng bằng ${canGhi.size} lệnh, ${((Date.now() - t0) / 1000).toFixed(2)} s.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
