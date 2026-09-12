import { db } from "./db";
import { matchTemplate } from "./quoteTemplate";

/** Vừa đủ để dựng ô chọn mẫu ở trình duyệt. */
export interface TemplateOption {
  id: string;
  name: string;
  buildingType: string | null;
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
    orderBy: { sortOrder: "asc" },
    select: { id: true, ten: true, loaiCongTrinh: true, sortOrder: true },
  });
  const rows = bos.map((b) => ({
    id: b.id,
    name: b.ten,
    buildingType: b.loaiCongTrinh,
    sortOrder: b.sortOrder,
  }));

  const hop = matchTemplate(rows, buildingType);
  return {
    options: rows.map(({ id, name, buildingType: bt }) => ({ id, name, buildingType: bt })),
    goiY: hop?.id ?? null,
  };
}
