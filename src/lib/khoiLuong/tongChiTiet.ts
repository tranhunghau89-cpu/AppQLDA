/**
 * Cộng bảng bóc chi tiết thành khối lượng của một đầu mục dự toán.
 *
 * Bảng bóc luôn có dạng "mấy cái, mỗi cái bao nhiêu". Cái gì được nhân vào là do ĐƠN VỊ
 * của đầu mục quyết định, không phải do định dạng file:
 *
 *   kg   → Σ số lượng × khối lượng đơn     (12 cột PL6*700 × 351,91 kg = 4.222,90 kg)
 *   m²   → Σ số lượng × diện tích đơn
 *   m    → Σ số lượng × chiều dài ÷ 1000   (bảng bóc ghi chiều dài bằng mm)
 *   còn lại → Σ số lượng                   (tấm, cái, bộ, con — chỉ đếm)
 *
 * Vì sao một hàm cho cả hai loại bảng: bảng thống kê kết cấu và bảng bóc tôn khác nhau ở
 * chỗ cột nào có số, chứ không khác nhau về bản chất. Tách đôi thì mọi phép cộng, mọi
 * màn hình và mọi phép kiểm đều phải viết hai lần và sớm muộn cũng lệch nhau.
 */

export interface DongChiTietKL {
  soLuong: number | null;
  /** mm */
  dai: number | null;
  /** kg mỗi cái */
  klDon: number | null;
  /** m² mỗi cái */
  dienTichDon: number | null;
}

/** Cột được nhân vào để ra tổng. `DEM` = chỉ đếm số lượng. */
export type CachCong = "KL_DON" | "DIEN_TICH" | "CHIEU_DAI" | "DEM";

export interface KetQuaTongChiTiet {
  /** `null` = chưa dòng nào đủ dữ liệu. KHÔNG phải 0 — 0 nghĩa là không có gì để làm. */
  tong: number | null;
  cach: CachCong;
  soDongTinh: number;
  /** Số dòng bị bỏ vì thiếu đúng cột mà đơn vị này cần. */
  soDongThieu: number;
  canhBao: string[];
}

const NHAN: Record<CachCong, string> = {
  KL_DON: "số lượng × khối lượng đơn",
  DIEN_TICH: "số lượng × diện tích đơn",
  CHIEU_DAI: "số lượng × chiều dài",
  DEM: "tổng số lượng",
};

/** Nhãn cột còn thiếu, để cảnh báo nói đúng tên thứ người dùng phải điền. */
const TEN_COT: Record<CachCong, string> = {
  KL_DON: "khối lượng đơn",
  DIEN_TICH: "diện tích đơn",
  CHIEU_DAI: "chiều dài",
  DEM: "số lượng",
};

const so = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) ? v : null;

/**
 * Đơn vị của đầu mục quyết định cách cộng.
 *
 * So sánh sau khi bỏ dấu và khoảng trắng vì đơn vị trong dữ liệu thật viết đủ kiểu:
 * "m2", "M2", "m²", "md", "mđ", "Kg". Không nhận ra thì lùi về ĐẾM — đó là cách duy
 * nhất không bịa ra một phép nhân mà người dùng không yêu cầu.
 */
export function cachCongTheoDonVi(donVi: string | null | undefined): CachCong {
  const s = (donVi ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/²/g, "2")
    .replace(/đ/g, "d");
  if (s === "kg") return "KL_DON";
  if (s === "m2") return "DIEN_TICH";
  if (s === "m" || s === "md" || s === "m dai" || s === "mdai") return "CHIEU_DAI";
  return "DEM";
}

export function tongChiTiet(
  dong: readonly DongChiTietKL[],
  donVi: string | null | undefined
): KetQuaTongChiTiet {
  const cach = cachCongTheoDonVi(donVi);
  const canhBao: string[] = [];
  let tong = 0;
  let soDongTinh = 0;
  let soDongThieu = 0;

  for (const d of dong) {
    const sl = so(d.soLuong);
    if (sl == null) {
      soDongThieu++;
      continue;
    }
    let gop: number | null;
    if (cach === "DEM") gop = sl;
    else if (cach === "KL_DON") {
      const k = so(d.klDon);
      gop = k == null ? null : sl * k;
    } else if (cach === "DIEN_TICH") {
      const k = so(d.dienTichDon);
      gop = k == null ? null : sl * k;
    } else {
      const k = so(d.dai);
      // Bảng bóc ghi chiều dài bằng mm; đầu mục tính bằng mét.
      gop = k == null ? null : (sl * k) / 1000;
    }
    if (gop == null || !Number.isFinite(gop)) {
      soDongThieu++;
      continue;
    }
    soDongTinh++;
    tong += gop;
  }

  if (soDongThieu > 0) {
    canhBao.push(
      `${soDongThieu} dòng chưa có ${TEN_COT[cach]} nên không vào được tổng.`
    );
  }
  if (!Number.isFinite(tong)) {
    return { tong: null, cach, soDongTinh: 0, soDongThieu: dong.length, canhBao };
  }

  return {
    tong: soDongTinh > 0 ? tong : null,
    cach,
    soDongTinh,
    soDongThieu,
    canhBao,
  };
}

/** Câu giải thích hiện dưới ô khối lượng: "= tổng số lượng × khối lượng đơn (58 dòng)". */
export function dienGiaiCach(kq: KetQuaTongChiTiet): string {
  return `${NHAN[kq.cach]} · ${kq.soDongTinh} dòng`;
}

/** Dưới 1 phần nghìn đơn vị thì chỉ là sai số dấu phẩy động, không phải lệch thật. */
const SAI_SO = 0.001;

/**
 * Khối lượng đang lưu trên đầu mục có còn khớp với bảng bóc không.
 *
 * Cần đến vì bảng bóc nhập lại từ file mới sẽ ra tổng khác, mà con số trên đầu mục là
 * ảnh chụp lúc ghi — giống mọi chỗ đóng băng giá khác trong app.
 */
export function lechVoiBangBoc(
  dangLuu: number | null | undefined,
  kq: KetQuaTongChiTiet
): boolean {
  if (kq.tong == null) return false;
  if (dangLuu == null) return true;
  return Math.abs(dangLuu - kq.tong) >= SAI_SO;
}
