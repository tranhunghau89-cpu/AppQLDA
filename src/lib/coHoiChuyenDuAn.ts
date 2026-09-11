// Chuyển một cơ hội chào giá thành dự án — phần thuần.
//
// Đây là chỗ khách hàng biến thành chủ đầu tư và công trình đang chào biến thành hợp
// đồng. Thao tác một chiều, không có nút hoàn tác, nên ba phép quyết định dưới đây phải
// có test: chuyển được hay chưa, CĐT nào đáng nghi là trùng, và dự án sinh ra mang gì.
//
// Phần ghi vào cơ sở dữ liệu nằm ở action; ở đây không đụng Prisma.

import { norm } from "./text";

export interface CoHoiDeChuyen {
  trangThai: string;
  projectId: string | null;
}

export interface BaoGiaTomTat {
  status: string;
}

export type KetQuaKiem = { duoc: true } | { duoc: false; lyDo: string };

/**
 * Cơ hội này đã đủ điều kiện thành dự án chưa.
 *
 * Đòi một bản báo giá gửi khách ở trạng thái "Đã chốt". Không phải thủ tục hành chính:
 * mã dự án là thứ dùng chung cả công ty và không ai muốn dọn, nên chỉ sinh khi có bằng
 * chứng khách đã đồng ý. Bằng chứng đó chính là bản báo giá được đánh dấu chốt.
 */
export function kiemDieuKienChuyen(
  coHoi: CoHoiDeChuyen,
  baoGia: BaoGiaTomTat[]
): KetQuaKiem {
  if (coHoi.projectId) {
    return { duoc: false, lyDo: "Công trình này đã thành dự án rồi." };
  }
  if (coHoi.trangThai === "MAT") {
    return {
      duoc: false,
      lyDo: 'Công trình đang ở trạng thái "Mất khách" — đổi lại trạng thái trước đã.',
    };
  }
  if (!baoGia.some((b) => b.status === "CHOT")) {
    return {
      duoc: false,
      lyDo: 'Chưa có báo giá nào ở trạng thái "Đã chốt" — chốt báo giá trước khi tạo dự án.',
    };
  }
  return { duoc: true };
}

export interface ChuDauTuCoSan {
  id: string;
  name: string;
}

/**
 * Chủ đầu tư đã có nào trông giống khách này.
 *
 * Chỉ để GỢI Ý, không tự áp: hai công ty tên gần giống nhau là chuyện thường, và áp
 * nhầm thì mọi hợp đồng sau đó treo lên sai pháp nhân. Người dùng vẫn phải tự chọn.
 *
 * Ba bậc từ chắc tới mơ hồ: trùng sau khi bỏ dấu — bên này chứa bên kia — chung một từ
 * đủ dài. Giữ nguyên thứ tự đó khi trả về để cái đáng tin nhất nằm trên đầu.
 */
export function goiYChuDauTu(
  danhSach: ChuDauTuCoSan[],
  tenKhach: string,
  toiDa = 5
): ChuDauTuCoSan[] {
  const can = norm(tenKhach);
  if (!can) return [];

  // Bỏ những từ ai cũng có, nếu không thì "Công ty CP A" khớp với "Công ty CP B".
  const BO_QUA = new Set(["cong", "ty", "congty", "cp", "tnhh", "mtv", "dn", "doanh", "nghiep"]);
  const tuCuaKhach = new Set(
    tenKhach
      .split(/\s+/)
      .map(norm)
      .filter((t) => t.length >= 4 && !BO_QUA.has(t))
  );

  const diem = (c: ChuDauTuCoSan): number => {
    const n = norm(c.name);
    if (!n) return 0;
    if (n === can) return 3;
    if (n.includes(can) || can.includes(n)) return 2;
    const tu = c.name.split(/\s+/).map(norm);
    if (tu.some((t) => t.length >= 4 && !BO_QUA.has(t) && tuCuaKhach.has(t))) return 1;
    return 0;
  };

  return danhSach
    .map((c) => ({ c, d: diem(c) }))
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, toiDa)
    .map((x) => x.c);
}

export interface CoHoiChuyenSang {
  tenCongTrinh: string;
  diaDiem: string | null;
  buildingType: string | null;
  area: number | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
}

export interface DuLieuDuAn {
  code: string;
  name: string;
  buildingType: string | null;
  location: string | null;
  area: number | null;
  kK: number | null;
  kL: number | null;
  kH: number | null;
  status: string;
  customerId: string;
  salePrice: number | null;
}

/**
 * Dữ liệu của dự án sắp tạo.
 *
 * Chép nguyên thông số hình học từ cơ hội — chúng đã dùng để tính giá rồi, gõ lại là mở
 * đường cho dự án và báo giá của chính nó nói hai con số khác nhau.
 *
 * `salePrice` lấy tổng sau thuế của bản báo giá đã chốt: con số hai bên vừa bắt tay.
 * Trạng thái mở ở "CHO" — hợp đồng vừa ký thì chưa khởi công.
 */
export function duLieuDuAnTuCoHoi(
  coHoi: CoHoiChuyenSang,
  code: string,
  customerId: string,
  giaBan: number | null,
  tenDuAn?: string | null
): DuLieuDuAn {
  return {
    code: code.trim(),
    name: (tenDuAn?.trim() || coHoi.tenCongTrinh).trim(),
    buildingType: coHoi.buildingType,
    location: coHoi.diaDiem,
    area: coHoi.area,
    kK: coHoi.kK,
    kL: coHoi.kL,
    kH: coHoi.kH,
    status: "CHO",
    customerId,
    salePrice: giaBan,
  };
}
