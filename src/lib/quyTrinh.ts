// Quy trình dự án: Thông tin dự án → QC từng giai đoạn. Luật thuần — không chạm DB,
// không đọc đồng hồ; dùng chung server + client. Thiết kế: plan/33_QuyTrinh_ThongTin_QC.md
import { MILESTONE_TYPE } from "@/lib/constants";

export const BUOC_THONG_TIN = "THONG_TIN";
export const CAC_BUOC: { value: string; label: string }[] = [
  { value: BUOC_THONG_TIN, label: "Thông tin dự án" },
  ...MILESTONE_TYPE.map((m) => ({ value: m.value, label: `QC ${m.label}` })),
];
export const TEN_BUOC: Record<string, string> = Object.fromEntries(
  CAC_BUOC.map((b) => [b.value, b.label]),
);

/** Trạng thái lưu trong DB. */
export type TrangThaiLuu = "DANG_LAM" | "CHO_DUYET" | "TRA_LAI" | "DA_DUYET";
/** Trạng thái hiển thị: thêm CHUA_MO (bước trước chưa duyệt) và BO_QUA (giai đoạn không có mục QC). */
export type TrangThaiHien = TrangThaiLuu | "CHUA_MO" | "BO_QUA";

export const TRANG_THAI_BUOC: Record<
  TrangThaiHien,
  { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }
> = {
  CHUA_MO: { label: "Chưa mở", tone: "slate" },
  BO_QUA: { label: "Bỏ qua", tone: "slate" },
  DANG_LAM: { label: "Đang làm", tone: "blue" },
  CHO_DUYET: { label: "Chờ duyệt", tone: "amber" },
  TRA_LAI: { label: "Trả lại", tone: "red" },
  DA_DUYET: { label: "Đã duyệt", tone: "green" },
};

export interface ThongTinDuAn {
  customerId: string | null;
  location: string | null;
  khuVucId: string | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
  area: number | null;
  salePrice: number | null;
  mauSon: string | null;
  mauTonMai: string | null;
  mauTonVach: string | null;
  soNguoiLienHe: number;
  soQuyCachVatTu: number;
}

/** Danh sách trường còn thiếu của bước Thông tin dự án (rỗng = đủ). */
export function thieuThongTin(p: ThongTinDuAn): string[] {
  const co = (v: string | null) => !!v && v.trim() !== "";
  const so = (v: number | null) => v != null && v > 0;
  const thieu: string[] = [];
  if (!p.customerId) thieu.push("Chủ đầu tư");
  if (!co(p.location)) thieu.push("Địa điểm");
  if (!p.khuVucId) thieu.push("Khu vực");
  if (!so(p.kK) || !so(p.kL) || !so(p.kH)) thieu.push("Kích thước K × L × H");
  if (!so(p.area)) thieu.push("Diện tích");
  if (!so(p.salePrice)) thieu.push("Giá trị hợp đồng");
  if (!co(p.mauSon)) thieu.push("Màu sơn");
  if (!co(p.mauTonMai)) thieu.push("Màu tôn mái");
  if (!co(p.mauTonVach)) thieu.push("Màu tôn vách");
  if (p.soNguoiLienHe < 1) thieu.push("Người liên hệ");
  if (p.soQuyCachVatTu < 1) thieu.push("Quy cách vật tư");
  return thieu;
}

export interface QcDem {
  tong: number;
  /** Đạt hoặc Không áp dụng. */
  xong: number;
}

/** Bước QC chốt được khi mọi mục đã Đạt / Không áp dụng. null = được gửi. */
export function loiGuiQc(d: QcDem): string | null {
  if (d.tong === 0) return "Giai đoạn chưa có mục QC.";
  const con = d.tong - d.xong;
  return con > 0 ? `Còn ${con}/${d.tong} mục QC chưa Đạt.` : null;
}

export interface BuocLuu {
  buoc: string;
  trangThai: TrangThaiLuu;
}

/**
 * Trạng thái hiển thị của cả chuỗi. Bước QC không có mục nào → BO_QUA (không chặn bước sau).
 * Bước còn DANG_LAM mà có bước trước chưa duyệt → CHUA_MO.
 */
export function tinhChuoi(
  luu: BuocLuu[],
  soMucQc: Record<string, number>,
): { buoc: string; trangThai: TrangThaiHien }[] {
  const theoBuoc = new Map(luu.map((b) => [b.buoc, b.trangThai]));
  let truocXong = true;
  return CAC_BUOC.map(({ value }) => {
    const tt = theoBuoc.get(value) ?? "DANG_LAM";
    let hien: TrangThaiHien;
    if (value !== BUOC_THONG_TIN && !soMucQc[value]) hien = "BO_QUA";
    else if (tt === "DANG_LAM" && !truocXong) hien = "CHUA_MO";
    else hien = tt;
    if (hien !== "BO_QUA" && hien !== "DA_DUYET") truocXong = false;
    return { buoc: value, trangThai: hien };
  });
}

/** Bước hiện tại của dự án: bước đầu tiên chưa duyệt / chưa bỏ qua. null = xong hết. */
export function buocHienTai(
  chuoi: { buoc: string; trangThai: TrangThaiHien }[],
): string | null {
  return chuoi.find((b) => b.trangThai !== "DA_DUYET" && b.trangThai !== "BO_QUA")?.buoc ?? null;
}

export type HanhDong = "GUI" | "DUYET" | "TRA_LAI";

/** null = được làm; chuỗi = lý do không được. Chỉ xét trạng thái, quyền xét ở server. */
export function loiChuyen(hanhDong: HanhDong, hien: TrangThaiHien): string | null {
  if (hien === "BO_QUA") return "Bước này không có mục QC — tự bỏ qua.";
  if (hien === "CHUA_MO") return "Bước trước chưa được duyệt.";
  if (hanhDong === "GUI")
    return hien === "DANG_LAM" || hien === "TRA_LAI" ? null : "Bước đã gửi hoặc đã duyệt.";
  return hien === "CHO_DUYET" ? null : "Bước chưa được gửi duyệt.";
}

export const TRANG_THAI_SAU: Record<HanhDong, TrangThaiLuu> = {
  GUI: "CHO_DUYET",
  DUYET: "DA_DUYET",
  TRA_LAI: "TRA_LAI",
};

/** Bộ phận mặc định phụ trách: bước 0 = Kinh doanh; bước QC = bộ phận có nhiều mục nhất. */
export function boPhanMacDinh(buoc: string, boPhanCacMuc: string[]): string {
  if (buoc === BUOC_THONG_TIN) return "SALES";
  const dem = new Map<string, number>();
  for (const b of boPhanCacMuc) dem.set(b, (dem.get(b) ?? 0) + 1);
  let tot = "ENGINEERING";
  let max = 0;
  for (const [b, n] of dem) if (n > max) [tot, max] = [b, n];
  return tot;
}
