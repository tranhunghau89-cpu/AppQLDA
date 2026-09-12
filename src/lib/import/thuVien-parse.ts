// Bóc sheet "DV" — Bảng danh mục công việc & đơn giá — thành công tác + bản giá.
// THUẦN: không đụng Prisma, không đọc file; nhận một `SheetLike` nên test được bằng
// một mảng ô giả.
//
// Bố cục sheet (hàng 4 là tiêu đề, dữ liệu từ hàng 5):
//   A=STT  B=MCV  C=ND  D=Loại  E=TSKT  F=DV  G=VT  H=NC_M  I=HS  J=GT  K=GC
// Từ cột L trở đi là ô tìm kiếm và bảng chú giải nhóm của file — KHÔNG phải dữ liệu.

import { num, text, type SheetLike } from "./cells";

export type { SheetLike };

/** Hàng đầu tiên chứa dữ liệu; hàng 4 là tiêu đề cột. */
const HANG_DAU = 5;

/** Mã công việc: hai chữ cái, dấu chấm, rồi số — "AA.110". */
const MA_CV = /^[A-Z]{2}\.\d/;

export interface CongTacNhap {
  ma: string;
  ten: string;
  tenNgan: string | null;
  quyCach: string | null;
  donVi: string | null;
  vatTu: number | null;
  nhanCongMay: number | null;
  heSo: number | null;
  /** Đơn giá trọn gói. Suy ra từ VT/NC_M/HS khi ô GT bỏ trống. */
  donGia: number | null;
  ghiChu: string | null;
  sortOrder: number;
}

export interface KetQuaBocThuVien {
  congTac: CongTacNhap[];
  canhBao: string[];
}

/**
 * Ngày hiệu lực suy từ tên file báo giá.
 *
 * Quy ước đặt tên của công ty: `BG_NX_<khung>_<tỉnh>_D<ngày><tháng>_<năm>`, ví dụ
 * `BG_NX_KL_HN_D2504_23` là 25/04/2023 và `BG_NX_K30L72_HN_D08_26` là tháng 08/2026
 * (dạng ngắn chỉ có tháng).
 *
 * Trả `null` khi không đọc được — chỗ gọi sẽ hỏi người dùng thay vì đoán bừa. Đoán
 * sai ngày hiệu lực là làm hỏng đúng thứ thư viện sinh ra để giữ: lịch sử giá.
 */
export function ngayHieuLucTuTenFile(fileBase: string): Date | null {
  const m = fileBase.match(/_D(\d{2})(\d{2})?_(\d{2})(?:\D|$)/i);
  if (!m) return null;

  const nam = 2000 + Number(m[3]);
  // Dạng dài "D2504" là ngày+tháng; dạng ngắn "D08" chỉ có tháng.
  const coNgay = m[2] != null;
  const ngay = coNgay ? Number(m[1]) : 1;
  const thang = coNgay ? Number(m[2]) : Number(m[1]);

  if (thang < 1 || thang > 12) return null;
  if (ngay < 1 || ngay > 31) return null;

  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  // Bắt ngày tràn tháng (31/02 thành 03/03) — Date tự cuộn chứ không báo lỗi.
  if (d.getUTCMonth() !== thang - 1 || d.getUTCDate() !== ngay) return null;
  return d;
}

/**
 * Đơn giá trọn gói.
 *
 * Ô GT trong file là công thức `(VT + NC_M) * HS`; khi nó trống thì tự tính lại —
 * `computeBaseCost` của ứng dụng dùng đúng phép này.
 */
function tinhDonGia(
  gt: number | null,
  vatTu: number | null,
  nhanCongMay: number | null,
  heSo: number | null
): number | null {
  if (gt != null) return gt;
  if (vatTu == null && nhanCongMay == null) return null;
  const g = ((vatTu ?? 0) + (nhanCongMay ?? 0)) * (heSo ?? 1);
  return Number.isFinite(g) ? g : null;
}

export function bocTachThuVien(ws: SheetLike): KetQuaBocThuVien {
  const congTac: CongTacNhap[] = [];
  const canhBao: string[] = [];
  const daGap = new Map<string, number>();

  for (let r = HANG_DAU; r <= ws.rowCount; r++) {
    const o = (c: number) => ws.getCell(r, c).value;
    const ma = text(o(2)).toUpperCase();
    if (!MA_CV.test(ma)) continue;

    const ten = text(o(3)) || text(o(4));
    if (!ten) {
      canhBao.push(`Mã ${ma} (hàng ${r}) không có tên — bỏ qua.`);
      continue;
    }

    // Mã trùng trong cùng một file: giữ dòng ĐẦU. Dòng sau thường là bản nháp bỏ
    // quên bên dưới; lấy dòng cuối sẽ âm thầm đổi giá của mã đó.
    const cu = daGap.get(ma);
    if (cu != null) {
      canhBao.push(`Mã ${ma} xuất hiện lại ở hàng ${r} (đã có ở hàng ${cu}) — bỏ dòng sau.`);
      continue;
    }
    daGap.set(ma, r);

    const vatTu = num(o(7));
    const nhanCongMay = num(o(8));
    const heSo = num(o(9));

    congTac.push({
      ma,
      ten,
      tenNgan: text(o(4)) || null,
      quyCach: text(o(5)) || null,
      donVi: text(o(6)) || null,
      vatTu,
      nhanCongMay,
      heSo,
      donGia: tinhDonGia(num(o(10)), vatTu, nhanCongMay, heSo),
      ghiChu: text(o(11)) || null,
      sortOrder: congTac.length,
    });
  }

  const khongGia = congTac.filter((c) => c.donGia == null).length;
  if (khongGia > 0) {
    canhBao.push(`${khongGia} mã không có đơn giá — vẫn tạo công tác, giá nhập sau.`);
  }

  return { congTac, canhBao };
}

// ----- So sánh với thư viện đang có -----

export interface GiaHienCo {
  ma: string;
  /** Đơn giá đang áp dụng tại ngày hiệu lực của file; null = chưa có bản giá nào. */
  donGia: number | null;
  /** Công tác đã có trong thư viện chưa. */
  daCoCongTac: boolean;
}

export type LoaiThayDoi = "CONG_TAC_MOI" | "GIA_MOI" | "DOI_GIA" | "KHONG_DOI" | "KHONG_CO_GIA";

export interface DongSoSanh {
  ma: string;
  ten: string;
  loai: LoaiThayDoi;
  giaCu: number | null;
  giaMoi: number | null;
}

export interface KetQuaSoSanh {
  dong: DongSoSanh[];
  congTacMoi: number;
  doiGia: number;
  khongDoi: number;
}

/** Hai đơn giá coi như bằng nhau khi lệch dưới 1 đồng — ô Excel toàn số thực. */
const SAI_SO = 1;

/**
 * Đối chiếu file với thư viện để biết dòng nào ĐÁNG ghi.
 *
 * Vì sao phải có bước này: bảng giá được chép từ file báo giá này sang file báo giá
 * khác, nên hai file cách nhau ba năm vẫn gần như y hệt. Chèn thẳng 135 bản giá mỗi
 * lần nhập là chôn lịch sử giá dưới đống dòng trùng — đúng thứ thư viện sinh ra để
 * giữ. Chỉ ghi khi con số thật sự đổi thì việc nhập lại cùng một file cũng hoá vô hại.
 */
export function soSanhVoiThuVien(
  nhap: readonly CongTacNhap[],
  hienCo: readonly GiaHienCo[]
): KetQuaSoSanh {
  const theoMa = new Map(hienCo.map((h) => [h.ma, h]));
  const dong: DongSoSanh[] = [];
  let congTacMoi = 0;
  let doiGia = 0;
  let khongDoi = 0;

  for (const c of nhap) {
    const cu = theoMa.get(c.ma);
    const giaCu = cu?.donGia ?? null;
    let loai: LoaiThayDoi;

    if (c.donGia == null) {
      loai = "KHONG_CO_GIA";
    } else if (!cu || !cu.daCoCongTac) {
      loai = "CONG_TAC_MOI";
    } else if (giaCu == null) {
      loai = "GIA_MOI";
    } else if (Math.abs(giaCu - c.donGia) < SAI_SO) {
      loai = "KHONG_DOI";
    } else {
      loai = "DOI_GIA";
    }

    if (loai === "CONG_TAC_MOI") congTacMoi++;
    else if (loai === "DOI_GIA" || loai === "GIA_MOI") doiGia++;
    else khongDoi++;

    dong.push({ ma: c.ma, ten: c.ten, loai, giaCu, giaMoi: c.donGia });
  }

  return { dong, congTacMoi, doiGia, khongDoi };
}
