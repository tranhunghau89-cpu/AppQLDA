// Nhắc việc hằng ngày: mốc công việc trễ hạn + đợt thanh toán tới hạn / quá hạn.
//
// Dashboard đã tính được những số này từ lâu, nhưng chỉ hiện khi có người chủ động mở
// trang. Ở đây gom lại thành một bản tin để gửi đi mỗi sáng.
//
// Phần tính toán là hàm THUẦN để test được; phần truy vấn và phần gửi tách riêng.

export interface MocTreInput {
  projectId: string;
  projectCode: string;
  projectName: string;
  type: string;
  planDate: Date;
}

export interface DotThanhToanInput {
  projectId: string;
  projectCode: string;
  direction: string; // THU | CHI
  name: string;
  counterpart: string | null;
  amount: number | null;
  dueDate: Date;
}

/**
 * Một bản báo giá gửi khách còn đang theo đuổi (DA_GUI / DAM_PHAN) và đã có hạn
 * hiệu lực. Báo giá đã chốt hoặc đã hủy không đưa vào đây.
 */
export interface BaoGiaTheoDoiInput {
  clientQuoteId: string;
  quoteNo: string | null;
  projectCode: string;
  customer: string | null;
  /** Tổng giá trị sau thuế — con số người đọc bản tin quan tâm. */
  total: number;
  expiryDate: Date;
  /** Hẹn liên hệ lại gần nhất trong nhật ký trao đổi của báo giá này. */
  henLienHeLai: Date | null;
}

export interface MocTre extends MocTreInput {
  soNgayTre: number;
}

export interface DotThanhToan extends DotThanhToanInput {
  /** Âm = đã quá hạn bấy nhiêu ngày; dương = còn bấy nhiêu ngày nữa tới hạn. */
  soNgayConLai: number;
  quaHan: boolean;
}

export interface BaoGiaTheoDoi extends BaoGiaTheoDoiInput {
  /** Âm = đã hết hiệu lực bấy nhiêu ngày; dương = còn bấy nhiêu ngày nữa. */
  soNgayConLai: number;
  hetHan: boolean;
}

export interface BanTinNhac {
  mocTre: MocTre[];
  quaHan: DotThanhToan[];
  sapToiHan: DotThanhToan[];
  baoGiaHetHan: BaoGiaTheoDoi[];
  baoGiaSapHetHan: BaoGiaTheoDoi[];
  tongPhaiThuQuaHan: number;
  tongPhaiTraQuaHan: number;
  /** true nếu không có gì để nhắc — khi đó không cần gửi. */
  rong: boolean;
}

const MOT_NGAY = 86_400_000;

/** Số ngày trọn vẹn giữa hai mốc (làm tròn xuống). */
function soNgay(tu: number, den: number): number {
  return Math.floor((den - tu) / MOT_NGAY);
}

/**
 * Gom dữ liệu thành bản tin nhắc việc.
 *
 * @param sapToiHanTrongNgay Số ngày tới được coi là "sắp tới hạn" (mặc định 7).
 * @param baoGia Báo giá gửi khách còn đang theo đuổi. Tham số này cố ý đứng CUỐI và
 *   có giá trị mặc định, để mọi lời gọi 3 tham số sẵn có giữ nguyên ý nghĩa — chèn
 *   vào giữa sẽ âm thầm diễn giải lại `sapToiHanTrongNgay`.
 */
export function buildReminderReport(
  mocChuaXong: MocTreInput[],
  dotChuaThanhToan: DotThanhToanInput[],
  now: number,
  sapToiHanTrongNgay = 7,
  baoGia: BaoGiaTheoDoiInput[] = []
): BanTinNhac {
  const mocTre: MocTre[] = mocChuaXong
    .filter((m) => m.planDate.getTime() < now)
    .map((m) => ({ ...m, soNgayTre: soNgay(m.planDate.getTime(), now) }))
    .sort((a, b) => b.soNgayTre - a.soNgayTre);

  const quaHan: DotThanhToan[] = [];
  const sapToiHan: DotThanhToan[] = [];
  const hanSap = now + sapToiHanTrongNgay * MOT_NGAY;

  for (const d of dotChuaThanhToan) {
    const t = d.dueDate.getTime();
    if (t < now) {
      quaHan.push({ ...d, soNgayConLai: soNgay(t, now) * -1, quaHan: true });
    } else if (t <= hanSap) {
      sapToiHan.push({ ...d, soNgayConLai: soNgay(now, t), quaHan: false });
    }
  }
  quaHan.sort((a, b) => a.soNgayConLai - b.soNgayConLai);
  sapToiHan.sort((a, b) => a.soNgayConLai - b.soNgayConLai);

  // Báo giá dùng đúng cùng cửa sổ "sắp tới hạn" và cùng quy ước dấu của số ngày
  // còn lại, để người đọc bản tin không phải nhớ hai cách tính.
  const baoGiaHetHan: BaoGiaTheoDoi[] = [];
  const baoGiaSapHetHan: BaoGiaTheoDoi[] = [];
  for (const b of baoGia) {
    const t = b.expiryDate.getTime();
    if (t < now) {
      baoGiaHetHan.push({ ...b, soNgayConLai: soNgay(t, now) * -1, hetHan: true });
    } else if (t <= hanSap) {
      baoGiaSapHetHan.push({ ...b, soNgayConLai: soNgay(now, t), hetHan: false });
    }
  }
  baoGiaHetHan.sort((a, b) => a.soNgayConLai - b.soNgayConLai);
  baoGiaSapHetHan.sort((a, b) => a.soNgayConLai - b.soNgayConLai);

  const tongPhaiThuQuaHan = quaHan
    .filter((d) => d.direction === "THU")
    .reduce((s, d) => s + (d.amount ?? 0), 0);
  const tongPhaiTraQuaHan = quaHan
    .filter((d) => d.direction === "CHI")
    .reduce((s, d) => s + (d.amount ?? 0), 0);

  return {
    mocTre,
    quaHan,
    sapToiHan,
    baoGiaHetHan,
    baoGiaSapHetHan,
    tongPhaiThuQuaHan,
    tongPhaiTraQuaHan,
    // Thêm mục mới thì BẮT BUỘC nhớ cả cờ này: route.ts dừng ngay khi rong = true,
    // quên ở đây là ship một mục được tính đầy đủ nhưng không bao giờ gửi đi.
    rong:
      mocTre.length === 0 &&
      quaHan.length === 0 &&
      sapToiHan.length === 0 &&
      baoGiaHetHan.length === 0 &&
      baoGiaSapHetHan.length === 0,
  };
}

function tien(v: number): string {
  return v.toLocaleString("vi-VN") + " ₫";
}

/** "14/09" — đủ để nhận ra một cái hẹn trong vài ngày tới. */
function ngayThang(d: Date): string {
  const hai = (n: number) => String(n).padStart(2, "0");
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
}

function dongBaoGia(b: BaoGiaTheoDoi): string {
  const ma = b.quoteNo ? `${b.quoteNo} · ` : "";
  const ai = b.customer ? ` — ${b.customer}` : "";
  const han = b.hetHan
    ? `hết hiệu lực ${Math.abs(b.soNgayConLai)} ngày trước`
    : `hết hiệu lực còn ${b.soNgayConLai} ngày`;
  const hen = b.henLienHeLai ? ` (hẹn liên hệ lại ${ngayThang(b.henLienHeLai)})` : "";
  return `  · ${ma}${b.projectCode}${ai}: ${tien(b.total)}, ${han}${hen}`;
}

/** Bản tin dạng chữ thuần — gửi được qua Zalo, Slack, email, hay chỉ để ghi log. */
export function formatReminderText(bt: BanTinNhac, gioiHanMoiMuc = 10): string {
  if (bt.rong) return "Không có mốc trễ hạn hay đợt thanh toán nào cần nhắc.";

  const d: string[] = ["[QLDA] Nhắc việc hôm nay", ""];

  if (bt.mocTre.length > 0) {
    d.push(`MỐC TRỄ HẠN (${bt.mocTre.length})`);
    for (const m of bt.mocTre.slice(0, gioiHanMoiMuc)) {
      d.push(`  · ${m.projectCode} ${m.projectName} — ${m.type}: trễ ${m.soNgayTre} ngày`);
    }
    if (bt.mocTre.length > gioiHanMoiMuc) d.push(`  … và ${bt.mocTre.length - gioiHanMoiMuc} mốc nữa`);
    d.push("");
  }

  if (bt.quaHan.length > 0) {
    d.push(`THANH TOÁN QUÁ HẠN (${bt.quaHan.length})`);
    if (bt.tongPhaiThuQuaHan > 0) d.push(`  Phải thu quá hạn: ${tien(bt.tongPhaiThuQuaHan)}`);
    if (bt.tongPhaiTraQuaHan > 0) d.push(`  Phải trả quá hạn: ${tien(bt.tongPhaiTraQuaHan)}`);
    for (const p of bt.quaHan.slice(0, gioiHanMoiMuc)) {
      const nhan = p.direction === "THU" ? "Thu" : "Chi";
      d.push(
        `  · ${p.projectCode} — ${nhan} "${p.name}"${p.counterpart ? ` (${p.counterpart})` : ""}: ` +
          `${p.amount != null ? tien(p.amount) : "—"}, quá hạn ${Math.abs(p.soNgayConLai)} ngày`
      );
    }
    if (bt.quaHan.length > gioiHanMoiMuc) d.push(`  … và ${bt.quaHan.length - gioiHanMoiMuc} đợt nữa`);
    d.push("");
  }

  if (bt.sapToiHan.length > 0) {
    d.push(`SẮP TỚI HẠN (${bt.sapToiHan.length})`);
    for (const p of bt.sapToiHan.slice(0, gioiHanMoiMuc)) {
      const nhan = p.direction === "THU" ? "Thu" : "Chi";
      d.push(
        `  · ${p.projectCode} — ${nhan} "${p.name}": ` +
          `${p.amount != null ? tien(p.amount) : "—"}, còn ${p.soNgayConLai} ngày`
      );
    }
    if (bt.sapToiHan.length > gioiHanMoiMuc)
      d.push(`  … và ${bt.sapToiHan.length - gioiHanMoiMuc} đợt nữa`);
    d.push("");
  }

  if (bt.baoGiaHetHan.length > 0) {
    d.push(`BÁO GIÁ HẾT HIỆU LỰC (${bt.baoGiaHetHan.length})`);
    for (const b of bt.baoGiaHetHan.slice(0, gioiHanMoiMuc)) d.push(dongBaoGia(b));
    if (bt.baoGiaHetHan.length > gioiHanMoiMuc)
      d.push(`  … và ${bt.baoGiaHetHan.length - gioiHanMoiMuc} báo giá nữa`);
    d.push("");
  }

  if (bt.baoGiaSapHetHan.length > 0) {
    d.push(`BÁO GIÁ SẮP HẾT HIỆU LỰC (${bt.baoGiaSapHetHan.length})`);
    for (const b of bt.baoGiaSapHetHan.slice(0, gioiHanMoiMuc)) d.push(dongBaoGia(b));
    if (bt.baoGiaSapHetHan.length > gioiHanMoiMuc)
      d.push(`  … và ${bt.baoGiaSapHetHan.length - gioiHanMoiMuc} báo giá nữa`);
  }

  return d.join("\n").trim();
}
