// Nhắc việc theo từng người: tách bản tin sáng thành phần việc của mỗi người, gửi vào
// chuông + hộp thư Trao đổi. Phần chia là hàm THUẦN để test; phần ghi DB tách riêng.
import { db } from "@/lib/db";
import {
  buildReminderReport,
  formatReminderText,
  type BaoGiaTheoDoiInput,
  type DotThanhToanInput,
  type HenLienHeInput,
  type MocTreInput,
} from "@/lib/reminders";

export interface NguoiNhac {
  id: string;
  role: string;
  /** Các dự án người này là thành viên. */
  duAn: Set<string>;
}

export interface DuLieuNhac {
  moc: MocTreInput[];
  dot: DotThanhToanInput[];
  baoGia: BaoGiaTheoDoiInput[];
  hen: HenLienHeInput[];
  /** khachHangId → người phụ trách khách. */
  chuKhach: Map<string, string | null>;
  /** Phiếu bảo hành còn mở có hạn tới trong cửa sổ nhắc (hoặc đã quá hạn). */
  baoHanh?: PhieuNhac[];
}

export interface PhieuNhac {
  projectCode: string;
  tieuDe: string;
  mucDo: string;
  phuTrachId: string | null;
  hanXuLy: Date;
}

/** Phiếu bảo hành của một người: phụ trách phiếu; Ban giám đốc thấy cả phiếu chưa giao. */
export function phieuCuaNguoi(u: Pick<NguoiNhac, "id" | "role">, ds: PhieuNhac[]): PhieuNhac[] {
  return ds.filter((p) => p.phuTrachId === u.id || (u.role === "ADMIN" && !p.phuTrachId));
}

/** Mục "BẢO HÀNH" của tin nhắc — hạn sớm nhất (quá hạn lâu nhất) đứng đầu. */
export function dongBaoHanh(ds: PhieuNhac[], now: number): string {
  if (ds.length === 0) return "";
  const xep = [...ds].sort((a, b) => a.hanXuLy.getTime() - b.hanXuLy.getTime());
  const d = [`BẢO HÀNH (${ds.length})`];
  for (const p of xep.slice(0, 10)) {
    const n = Math.floor((p.hanXuLy.getTime() - now) / 86_400_000);
    const han = n < 0 ? `quá hạn ${-n} ngày` : n === 0 ? "hạn hôm nay" : `còn ${n} ngày`;
    d.push(`  · ${p.mucDo === "KHAN" ? "[KHẨN] " : ""}${p.projectCode} — ${p.tieuDe}: ${han}${p.phuTrachId ? "" : " (chưa giao)"}`);
  }
  if (ds.length > 10) d.push(`  … và ${ds.length - 10} phiếu nữa`);
  return d.join("\n");
}

/**
 * Phần việc của một người:
 * - Ban giám đốc: mọi thứ.
 * - Mốc trễ: thành viên dự án.
 * - Thanh toán: kế toán (mọi dự án) + thành viên dự án.
 * - Báo giá sắp/đã hết hiệu lực: phòng kinh doanh.
 * - Hẹn liên hệ khách: người phụ trách khách.
 */
export function phanViec(u: NguoiNhac, d: DuLieuNhac): Omit<DuLieuNhac, "chuKhach" | "baoHanh"> {
  if (u.role === "ADMIN") return { moc: d.moc, dot: d.dot, baoGia: d.baoGia, hen: d.hen };
  return {
    moc: d.moc.filter((m) => u.duAn.has(m.projectId)),
    dot: u.role === "ACCOUNTING" ? d.dot : d.dot.filter((x) => u.duAn.has(x.projectId)),
    baoGia: u.role === "SALES" ? d.baoGia : [],
    hen: d.hen.filter((h) => d.chuKhach.get(h.khachHangId) === u.id),
  };
}

/** Khoá ngày theo giờ Việt Nam — cron chạy lại trong ngày không gửi trùng. */
export function khoaNgay(now: number): string {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Gửi mỗi người một tin "Nhắc việc" nếu họ có việc. Trả số người đã nhắn. */
export async function guiNhacTheoNguoi(d: DuLieuNhac, now: number, sapToiNgay: number): Promise<number> {
  const ngay = khoaNgay(now);
  const [users, members, daGui] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, role: true } }),
    db.projectMember.findMany({ select: { projectId: true, userId: true } }),
    db.traoDoiNhan.findMany({
      where: { traoDoi: { doiTuong: "NHAC_VIEC", doiTuongId: ngay } },
      select: { userId: true },
    }),
  ]);
  const roi = new Set(daGui.map((x) => x.userId));
  const duAn = new Map<string, Set<string>>();
  for (const m of members) {
    if (!duAn.has(m.userId)) duAn.set(m.userId, new Set());
    duAn.get(m.userId)!.add(m.projectId);
  }

  let so = 0;
  for (const u of users) {
    if (roi.has(u.id)) continue;
    const v = phanViec({ id: u.id, role: u.role, duAn: duAn.get(u.id) ?? new Set() }, d);
    const bt = buildReminderReport(v.moc, v.dot, now, sapToiNgay, v.baoGia, v.hen);
    const bh = dongBaoHanh(phieuCuaNguoi(u, d.baoHanh ?? []), now);
    if (bt.rong && !bh) continue;
    const chinh = bt.rong ? "" : formatReminderText(bt).replace(/^\[QLDA\] Nhắc việc hôm nay\s*/, "");
    await db.traoDoi.create({
      data: {
        doiTuong: "NHAC_VIEC",
        doiTuongId: ngay,
        nhanDe: `Việc của bạn hôm nay`,
        loai: "GHI_CHU",
        noiDung: [chinh, bh].filter(Boolean).join("\n\n"),
        tacGiaId: "he-thong",
        tacGiaTen: "Hệ thống",
        nguoiNhan: { create: [{ userId: u.id }] },
      },
    });
    so++;
  }
  return so;
}
