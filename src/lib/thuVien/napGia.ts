// Nạp bảng giá hiện hành từ thư viện. Phần CHẠM CƠ SỞ DỮ LIỆU của việc tra giá —
// luật chọn dòng nào áp dụng nằm ở ./gia.ts và được test riêng ở đó.
//
// Vì sao gom vào một chỗ: trang dự toán, nút "Tính lại giá" và việc chép báo giá đều
// cần đúng một thứ là "đơn giá của từng mã tại hôm nay". Ba nơi tự viết ba câu truy
// vấn là ba cơ hội để chúng lệch nhau.
import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { chonDonGia, type DongGiaUngVien } from "./gia";

export interface CongTacCoGia {
  id: string;
  ma: string;
  ten: string;
  donVi: string | null;
  /** Đơn giá đang áp dụng hôm nay; null = công tác chưa khai bản giá nào. */
  donGia: number | null;
}

/**
 * Toàn bộ công tác đang dùng kèm đơn giá hiện hành.
 *
 * Hai truy vấn cho cả danh mục, không phải một truy vấn cho mỗi công tác: 135 công
 * tác thì cách kia là 135 lượt đi về cơ sở dữ liệu chỉ để dựng một danh sách chọn.
 * Bọc `cache()` vì trang và trình soạn thảo trong cùng một lần tải đều hỏi cái này.
 */
export const napCongTacCoGia = cache(async (): Promise<CongTacCoGia[]> => {
  const ngay = new Date();
  const [congTacs, banGias] = await Promise.all([
    db.congTac.findMany({
      where: { active: true },
      orderBy: [{ nhomMa: "asc" }, { sortOrder: "asc" }, { ma: "asc" }],
      select: { id: true, ma: true, ten: true, donVi: true },
    }),
    db.donGiaCongTac.findMany({
      where: { hieuLucTu: { lte: ngay } },
      select: {
        id: true,
        congTacId: true,
        congTacVatTuId: true,
        khuVucId: true,
        donGia: true,
        hieuLucTu: true,
        createdAt: true,
      },
    }),
  ]);

  const theoCongTac = new Map<string, DongGiaUngVien[]>();
  for (const g of banGias) {
    const ds = theoCongTac.get(g.congTacId);
    if (ds) ds.push(g);
    else theoCongTac.set(g.congTacId, [g]);
  }

  return congTacs.map((c) => ({
    id: c.id,
    ma: c.ma,
    ten: c.ten,
    donVi: c.donVi,
    donGia: chonDonGia(theoCongTac.get(c.id) ?? [], { congTacId: c.id, ngay }).donGia,
  }));
});

/**
 * Bảng tra "Mã công tác -> đơn giá hiện hành", cho những chỗ đang khớp bằng mã
 * (QuoteItem.workCode là tham chiếu mềm bằng chuỗi).
 */
export async function banGiaTheoMa(): Promise<Map<string, number | null>> {
  const ds = await napCongTacCoGia();
  return new Map(ds.map((c) => [c.ma, c.donGia]));
}
