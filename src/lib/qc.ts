// QC theo giai đoạn: luật thuần — quyền đánh kết quả, kiểm tra đầu vào, đếm, cờ, sắp xếp.
// Không chạm DB, không đọc đồng hồ; dùng chung server + client.
import { QC_GIAI_DOAN_MAP, QC_KET_QUA_MAP } from "@/lib/constants";
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

type Tone = "slate" | "blue" | "amber" | "green" | "red" | "purple";

/** Kết quả được chọn khi đánh giá, theo nhóm mục. Việc / hồ sơ không có "Không đạt". */
export const KET_QUA_THEO_NHOM: Record<string, readonly string[]> = {
  VIEC: ["DAT", "KHONG_AP_DUNG"],
  HO_SO: ["DAT", "KHONG_AP_DUNG"],
  KIEM_TRA: ["DAT", "KHONG_DAT", "KHONG_AP_DUNG"],
};

const NHAN_THEO_NHOM: Record<string, Record<string, string>> = {
  VIEC: { CHUA: "Chưa làm", DAT: "Xong" },
  HO_SO: { CHUA: "Chưa có", DAT: "Đủ" },
};

/** Nhãn + màu của kết quả, đổi chữ theo nhóm (Việc: Xong, Hồ sơ: Đủ, Kiểm tra: Đạt). */
export function nhanKetQua(nhom: string, ketQua: string): { label: string; tone: Tone } {
  const goc = QC_KET_QUA_MAP[ketQua];
  return {
    label: NHAN_THEO_NHOM[nhom]?.[ketQua] ?? goc?.label ?? ketQua,
    tone: (goc?.tone ?? "slate") as Tone,
  };
}

/** Người dùng có được đánh kết quả mục thuộc `boPhan` không. ADMIN đánh được mọi bộ phận. */
export function duocDanhQc(role: string, boPhan: string): boolean {
  return role === "ADMIN" || role === boPhan;
}

/**
 * Liên kết làm bằng chứng: đường dẫn trong app ("/projects/…") hoặc http(s) ngoài.
 * Trả chuỗi đã chuẩn hoá, null = rỗng; ném lỗi chữ khi không hợp lệ.
 */
export function chuanLienKet(tho: string | null | undefined): string | null {
  const s = (tho ?? "").trim();
  if (!s) return null;
  if (s.length > 1000) throw new Error("Liên kết quá dài.");
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {}
  throw new Error("Liên kết phải là trang trong app hoặc địa chỉ http(s)://…");
}

/**
 * null = hợp lệ; chuỗi = lỗi để hiện cho người dùng.
 * Hồ sơ đánh "Đủ" phải có bằng chứng ngay trong lần đánh đó: tệp (`soTep`) hoặc liên kết.
 */
export function kiemTraDanhGia(v: {
  ketQua: string;
  ghiChu: string;
  nhom?: string;
  soTep?: number;
  coLienKet?: boolean;
}): string | null {
  const nhom = v.nhom ?? "KIEM_TRA";
  if (!(KET_QUA_THEO_NHOM[nhom] ?? []).includes(v.ketQua)) return "Kết quả không hợp lệ.";
  if (nhom === "HO_SO" && v.ketQua === "DAT" && !v.soTep && !v.coLienKet)
    return "Hồ sơ phải đính kèm tệp hoặc liên kết mới đánh Đủ được.";
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
          text: `QC ${ten} còn ${t.chua} mục chưa xong`,
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
