// Chọn đơn giá từ thư viện — logic THUẦN, không đụng Prisma, chạy được cả hai phía.
//
// Thư viện không sửa giá tại chỗ: đổi giá là thêm một dòng DonGiaCongTac với
// hieuLucTu mới. Nhờ vậy "ngày ký báo giá đó giá bao nhiêu" luôn tra lại được.
// Việc chọn ra dòng nào áp dụng vì thế là một phép lọc + xếp hạng, và nó nằm ở
// đây để test được — không nhét vào câu query.

import { formatNumber } from "@/lib/utils";

/** Một dòng đơn giá ứng viên. Chỉ những trường cần để chọn, không phải cả bản ghi. */
export interface DongGiaUngVien {
  id: string;
  congTacId: string;
  /** null = áp cho MỌI biến thể vật liệu của công tác. */
  congTacVatTuId: string | null;
  /** null = áp cho MỌI khu vực (giá chung toàn quốc). */
  khuVucId: string | null;
  donGia: number;
  hieuLucTu: Date;
  createdAt: Date;
}

export interface YeuCauGia {
  congTacId: string;
  congTacVatTuId?: string | null;
  khuVucId?: string | null;
  ngay: Date;
}

/**
 * Dòng giá tìm được khớp tới đâu. Đây là thứ làm giao diện trung thực: ô gợi ý
 * hiện "185.000 đ — giá chung toàn quốc" thay vì một con số trần, để người lập
 * báo giá biết mình đang tin vào cái gì.
 */
export type DoKhop =
  | "BIEN_THE_KHU_VUC"
  | "BIEN_THE"
  | "KHU_VUC"
  | "CHUNG"
  | "KHONG_CO";

export const DO_KHOP_LABEL: Record<DoKhop, string> = {
  BIEN_THE_KHU_VUC: "Giá riêng cho vật liệu & khu vực này",
  BIEN_THE: "Giá riêng cho vật liệu này",
  KHU_VUC: "Giá riêng cho khu vực này",
  CHUNG: "Giá chung toàn quốc",
  KHONG_CO: "Chưa có đơn giá",
};

export interface KetQuaChonGia {
  donGia: number | null;
  donGiaId: string | null;
  hieuLucTu: Date | null;
  doKhop: DoKhop;
  canhBao: string[];
}

const KHONG_TIM_THAY: KetQuaChonGia = {
  donGia: null,
  donGiaId: null,
  hieuLucTu: null,
  doKhop: "KHONG_CO",
  canhBao: [],
};

/** Điểm khớp: biến thể quan trọng hơn khu vực — đổi vật liệu đổi giá nhiều hơn đổi vùng. */
const DIEM_BIEN_THE = 8;
const DIEM_KHU_VUC = 4;

function diemKhop(c: DongGiaUngVien): number {
  return (c.congTacVatTuId ? DIEM_BIEN_THE : 0) + (c.khuVucId ? DIEM_KHU_VUC : 0);
}

/**
 * Ứng viên có dùng được cho yêu cầu này không.
 *
 * Dòng khai một biến thể/khu vực KHÁC cái đang hỏi thì bị loại hẳn chứ không hạ
 * điểm: giá tôn Hoa Sen ở Tây Ninh không phải là ước lượng tồi cho giá tôn Đông Á
 * ở Hà Nội — nó đơn giản là giá của thứ khác. Dòng khai `null` thì giữ lại vì null
 * nghĩa là "áp chung", tức là nó có nói gì về trường hợp đang hỏi.
 */
function dungDuoc(c: DongGiaUngVien, yc: YeuCauGia): boolean {
  if (c.congTacId !== yc.congTacId) return false;
  if (c.hieuLucTu.getTime() > yc.ngay.getTime()) return false;
  if (c.congTacVatTuId !== null && c.congTacVatTuId !== (yc.congTacVatTuId ?? null))
    return false;
  if (c.khuVucId !== null && c.khuVucId !== (yc.khuVucId ?? null)) return false;
  return true;
}

/**
 * So hai ứng viên, trả về số âm nếu `a` thắng.
 *
 * Thứ tự: điểm khớp cao hơn → hiệu lực muộn hơn → tạo sau → id nhỏ hơn. Nấc cuối
 * cùng bằng id là để kết quả TẤT ĐỊNH: hai dòng giống hệt nhau về mọi mặt vẫn
 * phải cho ra cùng một đáp án ở mọi lần chạy, nếu không thì test chập chờn và
 * người dùng thấy giá nhảy giữa hai lần tải trang.
 */
function xepHang(a: DongGiaUngVien, b: DongGiaUngVien): number {
  const d = diemKhop(b) - diemKhop(a);
  if (d !== 0) return d;
  const t = b.hieuLucTu.getTime() - a.hieuLucTu.getTime();
  if (t !== 0) return t;
  const c = b.createdAt.getTime() - a.createdAt.getTime();
  if (c !== 0) return c;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function doKhopCua(c: DongGiaUngVien): DoKhop {
  if (c.congTacVatTuId && c.khuVucId) return "BIEN_THE_KHU_VUC";
  if (c.congTacVatTuId) return "BIEN_THE";
  if (c.khuVucId) return "KHU_VUC";
  return "CHUNG";
}

/**
 * Chọn đơn giá áp dụng cho một dòng dự toán tại một thời điểm.
 *
 * KHÔNG bao giờ trả NaN/Infinity — không tìm được thì trả `donGia: null` kèm
 * `doKhop: "KHONG_CO"`, để chỗ gọi hiển thị ô trống cho người dùng tự nhập chứ
 * không in ra một con số vô nghĩa.
 */
export function chonDonGia(
  ungVien: readonly DongGiaUngVien[],
  yc: YeuCauGia
): KetQuaChonGia {
  const hopLe = ungVien.filter((c) => dungDuoc(c, yc));
  if (hopLe.length === 0) {
    return {
      ...KHONG_TIM_THAY,
      canhBao: [`Chưa có đơn giá nào có hiệu lực tới ngày đang xét.`],
    };
  }

  // Sao chép trước khi sắp xếp: hàm thuần không được sửa mảng của người gọi.
  const thang = [...hopLe].sort(xepHang)[0];
  const doKhop = doKhopCua(thang);

  const canhBao: string[] = [];
  if (yc.congTacVatTuId && !thang.congTacVatTuId) {
    canhBao.push("Chưa khai đơn giá riêng cho vật liệu này — đang dùng giá chung.");
  }
  if (yc.khuVucId && !thang.khuVucId) {
    canhBao.push("Chưa khai đơn giá riêng cho khu vực này — đang dùng giá chung.");
  }

  return {
    donGia: thang.donGia,
    donGiaId: thang.id,
    hieuLucTu: thang.hieuLucTu,
    doKhop,
    canhBao,
  };
}

// ----- Phát hiện trôi giá -----

export interface KetQuaTroiGia {
  coTroi: boolean;
  cu: number | null;
  moi: number | null;
}

/**
 * Đơn giá thư viện đã đổi kể từ lúc dòng này chốt giá chưa.
 *
 * TÍNH RA chứ không lưu cờ: một cờ `coTroi` trong DB ôi ngay khi ai đó thêm một
 * dòng giá, mà không có job nào làm mới nó. Một truy vấn có index mỗi lần tải
 * trang rẻ hơn một con số sai trên văn bản gửi chủ đầu tư.
 *
 * Chưa chụp giá (dòng cũ, hoặc người dùng tự gõ tay từ đầu) thì không có gì để so.
 */
export function phatHienTroiGia(
  donGiaDaChot: number | null | undefined,
  donGiaHienHanh: number | null | undefined
): KetQuaTroiGia {
  const cu = donGiaDaChot ?? null;
  const moi = donGiaHienHanh ?? null;
  if (cu === null || moi === null) return { coTroi: false, cu, moi };
  // Dưới một đồng là sai số làm tròn của phép nhân hệ số, không phải đổi giá.
  return { coTroi: Math.abs(moi - cu) >= 1, cu, moi };
}

export function nhanTroiGia(cu: number, moi: number): string {
  return `Đơn giá TV đã đổi: ${formatNumber(cu)} → ${formatNumber(moi)}`;
}
