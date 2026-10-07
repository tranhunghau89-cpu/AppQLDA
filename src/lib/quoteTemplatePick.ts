import { db } from "./db";
import { matchTemplate } from "./quoteTemplate";

/** Vừa đủ để dựng ô chọn mẫu ở trình duyệt. */
export interface TemplateOption {
  id: string;
  name: string;
  buildingType: string | null;
  /** Các phần của bộ — người lập tích chọn phần nào thành hạng mục báo giá. */
  phan?: PhanChon[];
}

export interface PhanChon {
  ma: string;
  ten: string;
  donVi: string | null;
  donGia: number | null;
  /** Tích sẵn khi mở — cờ "in cho khách" của bộ. */
  macDinh: boolean;
}

export interface TemplateChoices {
  options: TemplateOption[];
  /** Mẫu khớp loại công trình của dự án — chọn sẵn trong ô, người dùng đổi được. */
  goiY: string | null;
}

/**
 * Danh sách mẫu đang dùng + mẫu hợp nhất với loại công trình của dự án.
 *
 * Dùng ở CẢ hai đường lập báo giá (hộp thoại "Lập báo giá" và "Tạo báo giá gửi
 * khách" từ bản chi tiết) nên gom về một chỗ: hai nơi gợi ý khác nhau thì cùng một
 * dự án lại ra hai mẫu khác nhau tùy người dùng bấm nút nào.
 */
export async function templateChoices(
  buildingType: string | null | undefined
): Promise<TemplateChoices> {
  // Đọc từ BỘ HẠNG MỤC, không còn từ bảng mẫu báo giá cũ. `matchTemplate` nhận hình
  // dạng { buildingType, sortOrder } nên chỉ cần đổi tên trường ở đây — không đụng
  // vào hàm đã có bộ test tie-break riêng.
  const bos = await db.boHangMuc.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      ten: true,
      loaiCongTrinh: true,
      sortOrder: true,
      phan: {
        where: { parentId: null },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { ma: true, ten: true, tenKhachHang: true, donViKhach: true, donGiaKhach: true, inChoKhach: true },
      },
    },
  });
  const rows = bos.map((b) => ({
    id: b.id,
    name: b.ten,
    buildingType: b.loaiCongTrinh,
    sortOrder: b.sortOrder,
    phan: b.phan.map((p) => ({
      ma: p.ma,
      ten: p.tenKhachHang ?? p.ten,
      donVi: p.donViKhach,
      donGia: p.donGiaKhach,
      macDinh: p.inChoKhach,
    })),
  }));

  const hop = matchTemplate(rows, buildingType);
  return {
    options: rows.map(({ id, name, buildingType: bt, phan }) => ({ id, name, buildingType: bt, phan })),
    goiY: hop?.id ?? null,
  };
}
