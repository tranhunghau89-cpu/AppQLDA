// Bảng tổng hợp giá trị dự án theo giai đoạn: Báo giá → Dự toán → Mua hàng → Hợp đồng → Quyết toán.
// Tất cả là số CHƯA VAT để so cùng mặt bằng.

export interface GiaTriGiaiDoan {
  /** Chào giá đã chốt, không có thì bản mới nhất (bỏ bản huỷ). */
  baoGia: number | null;
  /** Tổng chi phí dự toán. */
  duToan: number;
  /** Tổng chi phí thực (dòng chưa có giá thực tạm lấy dự toán). */
  muaHang: number;
  soDongCoGiaThuc: number;
  soDong: number;
  /** Giá bán theo hợp đồng (= salePrice dự án). */
  hopDong: number | null;
  quyetToan: number | null;
}

export interface LoiNhuanGiaiDoan {
  duKien: number | null; // HĐ − dự toán
  thucTe: number | null; // (QT, chưa có thì HĐ) − chi phí thực
  /** true = lợi nhuận thực tế đang tạm tính theo HĐ vì chưa quyết toán. */
  tamTinh: boolean;
  bienThucTe: number | null;
}

export function loiNhuanGiaiDoan(g: GiaTriGiaiDoan): LoiNhuanGiaiDoan {
  const doanhThu = g.quyetToan ?? g.hopDong;
  const thucTe = doanhThu != null ? doanhThu - g.muaHang : null;
  return {
    duKien: g.hopDong != null ? g.hopDong - g.duToan : null,
    thucTe,
    tamTinh: g.quyetToan == null,
    bienThucTe: thucTe != null && doanhThu ? thucTe / doanhThu : null,
  };
}

export interface ClientQuoteForStage {
  status: string;
  createdAt: Date;
  beforeVat: number;
}

export function baoGiaGiaiDoan(quotes: ClientQuoteForStage[]): number | null {
  const conHieuLuc = quotes.filter((q) => q.status !== "HUY");
  const chot = conHieuLuc.filter((q) => q.status === "CHOT");
  const nguon = (chot.length > 0 ? chot : conHieuLuc).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return nguon[0]?.beforeVat ?? null;
}
