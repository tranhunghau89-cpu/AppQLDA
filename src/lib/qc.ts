// QC theo giai đoạn: luật thuần — quyền đánh kết quả, kiểm tra đầu vào, đếm, cờ, sắp xếp.
// Không chạm DB, không đọc đồng hồ; dùng chung server + client.
import { QC_GIAI_DOAN_MAP } from "@/lib/constants";
import { NGUONG_SAP_DEN_HAN, soNgay } from "@/lib/ngayVN";
import type { LyDo } from "@/lib/projectHealth";

export type KetQuaQc = "CHUA" | "DAT" | "KHONG_DAT" | "KHONG_AP_DUNG";
export interface QcMucLite {
  giaiDoan: string;
  ketQua: string;
}

/** Tách tiêu chí con: mỗi dòng một ý, bỏ dòng trống và gạch đầu dòng gõ tay. */
export function dongTieuChi(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\r?\n/)
    .map((d) => d.replace(/^\s*[-•*+]\s*/, "").trim())
    .filter(Boolean);
}

/** Chuẩn hoá tiêu chí con trước khi lưu; null khi không có ý nào. */
export function chuanTieuChi(s: string | null | undefined): string | null {
  const ds = dongTieuChi(s);
  return ds.length ? ds.join("\n") : null;
}

/** Người dùng có được đánh kết quả mục thuộc `boPhan` không. ADMIN đánh được mọi bộ phận. */
export function duocDanhQc(role: string, boPhan: string): boolean {
  return role === "ADMIN" || role === boPhan;
}

const DANH_DUOC = new Set(["DAT", "KHONG_DAT", "KHONG_AP_DUNG"]);

/** null = hợp lệ; chuỗi = lỗi để hiện cho người dùng. */
export function kiemTraDanhGia(v: { ketQua: string; ghiChu: string }): string | null {
  if (!DANH_DUOC.has(v.ketQua)) return "Kết quả không hợp lệ.";
  if (v.ketQua === "KHONG_DAT" && !v.ghiChu.trim())
    return "Không đạt thì phải ghi chú lỗi và hướng xử lý.";
  return null;
}

/** Đếm theo kết quả; `tong` bỏ mục Không áp dụng. */
export function tomTatGiaiDoan(muc: QcMucLite[]) {
  let dat = 0;
  let khongDat = 0;
  let chua = 0;
  let tong = 0;
  for (const m of muc) {
    if (m.ketQua === "KHONG_AP_DUNG") continue;
    tong++;
    if (m.ketQua === "DAT") dat++;
    else if (m.ketQua === "KHONG_DAT") khongDat++;
    else chua++;
  }
  return { dat, tong, khongDat, chua };
}

/**
 * Lý do cờ QC theo từng giai đoạn:
 * - ĐỎ: có mục Không đạt (kể cả khi mốc đã xong — lỗi chưa xử lý vẫn là lỗi).
 * - VÀNG: còn mục Chưa kiểm, mốc cùng giai đoạn chưa xong và đến hạn trong N ngày / đã quá hạn.
 */
export function lyDoQc(
  muc: QcMucLite[],
  milestones: { type: string; planDate: Date | null; done: boolean }[],
  nowMs: number
): LyDo[] {
  const theoGiaiDoan = new Map<string, QcMucLite[]>();
  for (const m of muc) {
    const ds = theoGiaiDoan.get(m.giaiDoan) ?? [];
    ds.push(m);
    theoGiaiDoan.set(m.giaiDoan, ds);
  }
  const out: LyDo[] = [];
  for (const [giaiDoan, ds] of theoGiaiDoan) {
    const ten = QC_GIAI_DOAN_MAP[giaiDoan]?.label ?? giaiDoan;
    const t = tomTatGiaiDoan(ds);
    if (t.khongDat > 0) {
      out.push({ muc: "DO", loai: "QC", soNgay: t.khongDat, text: `QC ${ten}: ${t.khongDat} mục không đạt` });
    }
    const moc = milestones.find((x) => x.type === giaiDoan);
    if (t.chua > 0 && moc && !moc.done && moc.planDate) {
      const conLai = soNgay(nowMs, moc.planDate.getTime());
      if (conLai <= NGUONG_SAP_DEN_HAN) {
        out.push({
          muc: "VANG",
          loai: "QC",
          soNgay: Math.max(0, conLai),
          text: `QC ${ten} còn ${t.chua} mục chưa kiểm`,
        });
      }
    }
  }
  return out;
}

/** Không đạt trước; rồi hạn tăng dần; không có hạn xếp cuối. */
export function sapXepViecQc<T extends { ketQua: string; han: Date | null }>(a: T, b: T): number {
  const ka = a.ketQua === "KHONG_DAT" ? 0 : 1;
  const kb = b.ketQua === "KHONG_DAT" ? 0 : 1;
  if (ka !== kb) return ka - kb;
  const ha = a.han?.getTime() ?? Infinity;
  const hb = b.han?.getTime() ?? Infinity;
  return ha === hb ? 0 : ha < hb ? -1 : 1;
}
