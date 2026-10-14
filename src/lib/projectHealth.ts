// Sức khoẻ dự án: cờ ĐỎ/VÀNG và chỉ số cho bảng thông tin dự án.
//
// Hàm thuần — không chạm DB, không đọc đồng hồ. Server component truyền `serverNow()` vào.
// Cờ tính lúc tải trang, không lưu: dữ liệu nguồn (mốc, đợt thu, đơn mua) đổi là cờ đổi theo.
import {
  MILESTONE_TYPE,
  MILESTONE_TYPE_MAP,
  PO_CATEGORY_MAP,
} from "@/lib/constants";
import {
  pickContractValue,
  type ContractValueInput,
} from "@/lib/contractValue";
import { formatVND } from "@/lib/utils";
import { NGUONG_SAP_DEN_HAN, dauNgayVN, soNgay } from "@/lib/ngayVN";
import { lyDoQc } from "@/lib/qc";
import { lyDoQuyTrinh, type TrangThaiHien } from "@/lib/quyTrinh";

export { NGUONG_SAP_DEN_HAN, dauNgayVN, soNgay };

export type MucCo = "DO" | "VANG" | null;
export type TrangThaiMoc = "XONG" | "TRE" | "SAP_DEN" | "DUNG_HAN" | "CHUA_CO";

export interface LyDo {
  muc: "DO" | "VANG";
  loai: "TIEN_DO" | "THU_TIEN" | "VAT_TU" | "QC" | "QUY_TRINH";
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
  purchaseOrders: {
    category: string;
    status: string;
    expectedDate: Date | null;
  }[];
  contracts: ContractValueInput[];
  salePrice: number | null;
  /** Mục QC của dự án; bỏ trống = dự án chưa có danh mục QC. */
  qc?: { giaiDoan: string; ketQua: string }[];
  /** Chuỗi bước quy trình; bỏ trống = không xét. */
  quyTrinh?: { buoc: string; ten: string; trangThai: TrangThaiHien; han: Date | null }[];
}

function phanLoaiHan(
  han: Date,
  nowMs: number,
): { muc: "DO" | "VANG"; n: number } | null {
  const d = soNgay(nowMs, han.getTime());
  if (d < 0) return { muc: "DO", n: -d };
  if (d <= NGUONG_SAP_DEN_HAN) return { muc: "VANG", n: d };
  return null;
}

export function trangThaiMoc(
  m: { planDate: Date | null; done: boolean },
  nowMs: number,
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
  opts: { anTien?: boolean } = {},
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
      text:
        p.muc === "DO"
          ? `Quá hạn ${ten} ${p.n} ngày`
          : `${ten} còn ${p.n} ngày`,
    });
  }

  // Vai không được xem tiền thì cũng không thấy tình hình thu tiền.
  for (const x of opts.anTien ? [] : d.payments) {
    if (x.direction !== "THU" || x.amount == null || !x.dueDate) continue;
    const thieu = x.amount - (x.paidAmount ?? 0);
    if (thieu <= 0) continue;
    const p = phanLoaiHan(x.dueDate, nowMs);
    if (!p) continue;
    const tien = `: ${formatVND(thieu)}`; // chỉ tới đây khi được xem tiền
    lyDo.push({
      muc: p.muc,
      loai: "THU_TIEN",
      soNgay: p.n,
      text:
        p.muc === "DO"
          ? `Quá hạn thu ${x.name} ${p.n} ngày${tien}`
          : `Đến hạn thu ${x.name} còn ${p.n} ngày${tien}`,
    });
  }

  for (const o of d.purchaseOrders) {
    if (o.status === "RECEIVED" || !o.expectedDate) continue;
    const n = -soNgay(nowMs, o.expectedDate.getTime());
    if (n <= 0) continue; // vật tư chỉ có cờ ĐỎ
    const ten = PO_CATEGORY_MAP[o.category]?.label ?? o.category;
    lyDo.push({
      muc: "DO",
      loai: "VAT_TU",
      soNgay: n,
      text: `Trễ giao ${ten} ${n} ngày`,
    });
  }

  lyDo.push(...lyDoQc(d.qc ?? [], d.milestones, nowMs));
  lyDo.push(...lyDoQuyTrinh(d.quyTrinh ?? [], d.milestones, nowMs));

  lyDo.sort((a, b) =>
    a.muc !== b.muc
      ? a.muc === "DO"
        ? -1
        : 1
      : a.muc === "DO"
        ? b.soNgay - a.soNgay
        : a.soNgay - b.soNgay,
  );
  return { muc: lyDo[0]?.muc ?? null, lyDo };
}

export function tinhChiSo(d: HealthInput): {
  tienDo: number;
  daThu: number | null;
  giaTriHD: number | null;
  /** null = chưa lập đợt thu nào (chưa biết), khác 0 = đã thu đủ. */
  conPhaiThu: number | null;
} {
  const xong = d.milestones.filter(
    (m) => m.done && m.type in MILESTONE_TYPE_MAP,
  ).length;
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
    // trả dư không hiện số âm; chưa có kế hoạch thu thì chưa biết
    conPhaiThu: keHoach > 0 ? Math.max(0, keHoach - thucThu) : null,
  };
}

const HANG: Record<string, number> = { DO: 0, VANG: 1 };

/** Sắp xếp ĐỎ → VÀNG → không cờ. */
export function soSanhCo(a: MucCo, b: MucCo): number {
  return (a ? HANG[a] : 2) - (b ? HANG[b] : 2);
}
