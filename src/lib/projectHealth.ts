// Sức khoẻ dự án: cờ ĐỎ/VÀNG và chỉ số cho bảng thông tin dự án.
//
// Hàm thuần — không chạm DB, không đọc đồng hồ. Server component truyền `serverNow()` vào.
// Cờ tính lúc tải trang, không lưu: dữ liệu nguồn (mốc, đợt thu, đơn mua) đổi là cờ đổi theo.
import { MILESTONE_TYPE, MILESTONE_TYPE_MAP, PO_CATEGORY_MAP } from "@/lib/constants";
import { pickContractValue, type ContractValueInput } from "@/lib/contractValue";
import { formatVND } from "@/lib/utils";

export const NGUONG_SAP_DEN_HAN = 7;
const NGAY = 86_400_000;
const LECH_VN = 7 * 3_600_000;

export type MucCo = "DO" | "VANG" | null;
export type TrangThaiMoc = "XONG" | "TRE" | "SAP_DEN" | "DUNG_HAN" | "CHUA_CO";

export interface LyDo {
  muc: "DO" | "VANG";
  loai: "TIEN_DO" | "THU_TIEN" | "VAT_TU";
  text: string;
  /** Số ngày trễ (ĐỎ) hoặc số ngày còn lại (VÀNG). */
  soNgay: number;
}

export interface HealthInput {
  milestones: { type: string; planDate: Date | null; done: boolean }[];
  payments: {
    direction: string;
    name: string;
    amount: number | null;
    paidAmount: number | null;
    dueDate: Date | null;
  }[];
  purchaseOrders: { category: string; status: string; expectedDate: Date | null }[];
  contracts: ContractValueInput[];
  salePrice: number | null;
}

/** Mốc 00:00 giờ Việt Nam của ngày chứa `ms`. */
export function dauNgayVN(ms: number): number {
  return Math.floor((ms + LECH_VN) / NGAY) * NGAY - LECH_VN;
}

/** Số ngày VN từ `tu` tới `den` (âm nếu `den` ở trước). */
export function soNgay(tu: number, den: number): number {
  return Math.round((dauNgayVN(den) - dauNgayVN(tu)) / NGAY);
}

function phanLoaiHan(han: Date, nowMs: number): { muc: "DO" | "VANG"; n: number } | null {
  const d = soNgay(nowMs, han.getTime());
  if (d < 0) return { muc: "DO", n: -d };
  if (d <= NGUONG_SAP_DEN_HAN) return { muc: "VANG", n: d };
  return null;
}

export function trangThaiMoc(
  m: { planDate: Date | null; done: boolean },
  nowMs: number
): TrangThaiMoc {
  if (m.done) return "XONG";
  if (!m.planDate) return "CHUA_CO";
  const p = phanLoaiHan(m.planDate, nowMs);
  if (!p) return "DUNG_HAN";
  return p.muc === "DO" ? "TRE" : "SAP_DEN";
}

export function tinhCo(
  d: HealthInput,
  nowMs: number,
  opts: { anTien?: boolean } = {}
): { muc: MucCo; lyDo: LyDo[] } {
  const lyDo: LyDo[] = [];

  for (const m of d.milestones) {
    if (m.done || !m.planDate) continue;
    const p = phanLoaiHan(m.planDate, nowMs);
    if (!p) continue;
    const ten = MILESTONE_TYPE_MAP[m.type]?.label ?? m.type;
    lyDo.push({
      muc: p.muc,
      loai: "TIEN_DO",
      soNgay: p.n,
      text: p.muc === "DO" ? `Quá hạn ${ten} ${p.n} ngày` : `${ten} còn ${p.n} ngày`,
    });
  }

  for (const x of d.payments) {
    if (x.direction !== "THU" || x.amount == null || !x.dueDate) continue;
    const thieu = x.amount - (x.paidAmount ?? 0);
    if (thieu <= 0) continue;
    const p = phanLoaiHan(x.dueDate, nowMs);
    if (!p) continue;
    // Người không được xem tiền vẫn thấy có đợt quá hạn, nhưng không thấy số tiền.
    const tien = opts.anTien ? "" : `: ${formatVND(thieu)}`;
    lyDo.push({
      muc: p.muc,
      loai: "THU_TIEN",
      soNgay: p.n,
      text:
        p.muc === "DO"
          ? `Quá hạn thu ${x.name}${tien || ` ${p.n} ngày`}`
          : `Đến hạn thu ${x.name} còn ${p.n} ngày${tien}`,
    });
  }

  for (const o of d.purchaseOrders) {
    if (o.status === "RECEIVED" || !o.expectedDate) continue;
    const n = -soNgay(nowMs, o.expectedDate.getTime());
    if (n <= 0) continue; // vật tư chỉ có cờ ĐỎ
    const ten = PO_CATEGORY_MAP[o.category]?.label ?? o.category;
    lyDo.push({ muc: "DO", loai: "VAT_TU", soNgay: n, text: `Trễ giao ${ten} ${n} ngày` });
  }

  lyDo.sort((a, b) =>
    a.muc !== b.muc
      ? a.muc === "DO"
        ? -1
        : 1
      : a.muc === "DO"
        ? b.soNgay - a.soNgay
        : a.soNgay - b.soNgay
  );
  return { muc: lyDo[0]?.muc ?? null, lyDo };
}

export function tinhChiSo(d: HealthInput): {
  tienDo: number;
  daThu: number | null;
  giaTriHD: number | null;
  conPhaiThu: number;
} {
  const xong = d.milestones.filter((m) => m.done && m.type in MILESTONE_TYPE_MAP).length;
  let keHoach = 0;
  let thucThu = 0;
  for (const x of d.payments) {
    if (x.direction !== "THU") continue;
    keHoach += x.amount ?? 0;
    thucThu += x.paidAmount ?? 0;
  }
  return {
    tienDo: xong / MILESTONE_TYPE.length,
    daThu: keHoach > 0 ? thucThu / keHoach : null,
    giaTriHD: pickContractValue(d.contracts) ?? d.salePrice,
    conPhaiThu: keHoach - thucThu,
  };
}

const HANG: Record<string, number> = { DO: 0, VANG: 1 };

/** Sắp xếp ĐỎ → VÀNG → không cờ. */
export function soSanhCo(a: MucCo, b: MucCo): number {
  return (a ? HANG[a] : 2) - (b ? HANG[b] : 2);
}
