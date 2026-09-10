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

export interface MocTre extends MocTreInput {
  soNgayTre: number;
}

export interface DotThanhToan extends DotThanhToanInput {
  /** Âm = đã quá hạn bấy nhiêu ngày; dương = còn bấy nhiêu ngày nữa tới hạn. */
  soNgayConLai: number;
  quaHan: boolean;
}

export interface BanTinNhac {
  mocTre: MocTre[];
  quaHan: DotThanhToan[];
  sapToiHan: DotThanhToan[];
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
 */
export function buildReminderReport(
  mocChuaXong: MocTreInput[],
  dotChuaThanhToan: DotThanhToanInput[],
  now: number,
  sapToiHanTrongNgay = 7
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
    tongPhaiThuQuaHan,
    tongPhaiTraQuaHan,
    rong: mocTre.length === 0 && quaHan.length === 0 && sapToiHan.length === 0,
  };
}

function tien(v: number): string {
  return v.toLocaleString("vi-VN") + " ₫";
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
  }

  return d.join("\n").trim();
}
