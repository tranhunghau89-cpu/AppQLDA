// Đổ một bản dự toán chào giá xuống dự toán thi công — logic THUẦN, không đụng Prisma.
//
// Hai bên có hình dạng khác nhau nên phép đổ không phải là chép một-đối-một:
//
//   Dự toán chào giá | QuoteSection là CÂY hai tầng: PHẦN (A, B, C…) chứa các NHÓM
//                      (I, II…), dòng nằm ở tầng dưới cùng.
//   Dự toán thi công | EstimateSection PHẲNG, không có cha. Tầng hai nằm ở cột chữ
//                      `groupLabel` trên từng dòng.
//
// Vì vậy PHẦN thành hạng mục, còn NHÓM tụt xuống thành `groupLabel`. Đây không phải
// lựa chọn thẩm mỹ: mã nhóm LẶP LẠI giữa các phần — mọi phần đều có một nhóm mang mã
// "I" tên "Phần kết cấu thép". Cho nhóm thành hạng mục là tạo ra năm hạng mục trùng
// tên mà không ai phân biệt nổi.

/** Một phần/nhóm của bản dự toán chào giá (QuoteSection). */
export interface PhanNguon {
  id: string;
  ma: string;
  ten: string;
  /** PHAN | SUB */
  loai: string;
  parentId: string | null;
  sortOrder: number;
}

/** Một dòng của bản dự toán chào giá, đã tra sẵn công tác trong thư viện. */
export interface DongNguon {
  id: string;
  sectionId: string;
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  /** Giá VỐN của dòng — dự toán thi công theo dõi chi phí, không theo dõi giá bán. */
  giaVon: number | null;
  ghiChu: string | null;
  sortOrder: number;

  congTacId: string | null;
  donGiaId: string | null;
  /** Người lập đã đè giá bằng tay. */
  giaSuaTay: boolean;
  /** Nhóm chi phí suy từ công tác; null = không tra được. */
  nhomChiPhi: string | null;
}

export interface HangMucMoi {
  /** Khoá tạm để dòng bám vào — chỗ gọi tạo hạng mục trước rồi mới có id thật. */
  khoa: string;
  ma: string | null;
  ten: string;
  sortOrder: number;
}

export interface DongMoi {
  /** Khoá của hạng mục chứa dòng này. */
  hangMucKhoa: string;
  groupLabel: string | null;
  groupCode: string;
  ten: string;
  donVi: string | null;
  khoiLuong: number | null;
  donGia: number | null;
  thanhTien: number | null;
  ghiChu: string | null;
  sortOrder: number;

  congTacId: string | null;
  donGiaId: string | null;
}

export interface KetQuaDoXuong {
  hangMuc: HangMucMoi[];
  dong: DongMoi[];
  canhBao: string[];
}

/** Nhóm chi phí mặc định khi không tra được công tác trong thư viện. */
const NHOM_MAC_DINH = "KHAC";

/**
 * Dòng nằm thẳng trong một PHẦN thì không có nhóm, và phải đứng TRƯỚC các dòng có
 * nhóm. Dùng -1 chứ không dùng 0 vì `sortOrder` của nhóm đầu tiên vốn là 0.
 */
const KHONG_CO_NHOM = -1;

function soHopLe(x: number | null | undefined): number | null {
  if (x == null) return null;
  return Number.isFinite(x) ? x : null;
}

/**
 * Thành tiền chỉ tính khi có ĐỦ cả khối lượng lẫn đơn giá.
 *
 * Thiếu một vế mà vẫn nhân ra 0 là nói dối: 0 đồng và "chưa biết" là hai chuyện khác
 * nhau, và cột thành tiền sẽ cộng cái 0 đó vào tổng chi phí.
 */
function thanhTien(khoiLuong: number | null, donGia: number | null): number | null {
  if (khoiLuong == null || donGia == null) return null;
  const t = khoiLuong * donGia;
  return Number.isFinite(t) ? t : null;
}

/**
 * Bóc bản dự toán chào giá thành hạng mục + dòng cho dự toán thi công.
 *
 * Hạng mục nào không nhận được dòng nào thì BỎ kèm cảnh báo — một hạng mục rỗng trong
 * dự toán thi công không nói lên điều gì, chỉ tốn một dòng người dùng phải tự xoá.
 *
 * `donGiaId` chỉ đi theo khi người lập KHÔNG sửa giá tay. Cột đó trả lời câu "con số
 * này lấy từ bản giá nào"; nếu giá đã bị gõ đè thì con số không còn đến từ bản giá ấy
 * nữa, và gắn vào là ghi một xuất xứ sai.
 */
export function doXuongDuToan(
  phanNguon: readonly PhanNguon[],
  dongNguon: readonly DongNguon[]
): KetQuaDoXuong {
  const canhBao: string[] = [];

  const theoId = new Map<string, PhanNguon>();
  for (const p of phanNguon) theoId.set(p.id, p);

  // Hạng mục của một phần: chính nó nếu là PHẦN gốc, còn không thì phần cha.
  // Nhóm mồ côi (khai SUB nhưng cha đã mất) tự đứng làm hạng mục — mất tầng cha còn
  // hơn mất dòng.
  const goc = new Map<string, PhanNguon>(); // id phần bất kỳ -> phần làm hạng mục
  const nhomCua = new Map<string, PhanNguon | null>(); // id phần -> nhóm cấp 2
  for (const p of phanNguon) {
    const cha = p.parentId ? theoId.get(p.parentId) : undefined;
    if (cha) {
      goc.set(p.id, cha);
      nhomCua.set(p.id, p);
    } else {
      if (p.parentId) {
        canhBao.push(`Nhóm "${p.ma} — ${p.ten}" mất phần cha, tự đứng làm hạng mục.`);
      }
      goc.set(p.id, p);
      nhomCua.set(p.id, null);
    }
  }

  interface DongXep {
    dong: DongMoi;
    thuTuNhom: number;
  }
  const dongTheoHangMuc = new Map<string, DongXep[]>();
  let soKhongTraDuoc = 0;
  let soSuaTay = 0;

  // Sắp xếp bản sao: hàm thuần không đụng mảng của người gọi.
  for (const d of [...dongNguon].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const phan = theoId.get(d.sectionId);
    if (!phan) {
      canhBao.push(`Dòng "${d.ten}" không thuộc phần nào — bỏ qua.`);
      continue;
    }
    const hangMuc = goc.get(phan.id);
    if (!hangMuc) continue; // không xảy ra: mọi phần đều có mục trong `goc`
    const nhom = nhomCua.get(phan.id) ?? null;

    if (!d.nhomChiPhi) soKhongTraDuoc += 1;
    if (d.giaSuaTay) soSuaTay += 1;

    const khoiLuong = soHopLe(d.khoiLuong);
    const donGia = soHopLe(d.giaVon);

    const ds = dongTheoHangMuc.get(hangMuc.id) ?? [];
    ds.push({
      thuTuNhom: nhom ? nhom.sortOrder : KHONG_CO_NHOM,
      dong: {
        hangMucKhoa: hangMuc.id,
        groupLabel: nhom ? nhom.ten : null,
        groupCode: d.nhomChiPhi ?? NHOM_MAC_DINH,
        ten: d.ten,
        donVi: d.donVi,
        khoiLuong,
        donGia,
        thanhTien: thanhTien(khoiLuong, donGia),
        ghiChu: d.ghiChu,
        sortOrder: 0, // đánh lại sau khi xếp
        congTacId: d.congTacId,
        donGiaId: d.giaSuaTay ? null : d.donGiaId,
      },
    });
    dongTheoHangMuc.set(hangMuc.id, ds);
  }

  const hangMuc: HangMucMoi[] = [];
  const dong: DongMoi[] = [];

  for (const p of [...phanNguon].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (goc.get(p.id)?.id !== p.id) continue; // chỉ phần gốc mới thành hạng mục
    const ds = dongTheoHangMuc.get(p.id);
    if (!ds || ds.length === 0) {
      canhBao.push(`Hạng mục "${p.ma} — ${p.ten}" không có dòng nào — bỏ qua.`);
      continue;
    }

    hangMuc.push({
      khoa: p.id,
      ma: p.ma || null,
      ten: p.ten,
      sortOrder: hangMuc.length,
    });

    // Trong một hạng mục: xếp theo nhóm trước, rồi giữ nguyên thứ tự dòng của bản gốc.
    ds.sort((a, b) => a.thuTuNhom - b.thuTuNhom);
    ds.forEach((x, i) => {
      dong.push({ ...x.dong, sortOrder: i });
    });
  }

  if (soKhongTraDuoc > 0) {
    canhBao.push(
      `${soKhongTraDuoc} dòng không tra được công tác trong thư viện — xếp vào nhóm "Khác".`
    );
  }
  if (soSuaTay > 0) {
    canhBao.push(`${soSuaTay} dòng có giá sửa tay — không gắn nguồn giá thư viện.`);
  }

  return { hangMuc, dong, canhBao };
}
